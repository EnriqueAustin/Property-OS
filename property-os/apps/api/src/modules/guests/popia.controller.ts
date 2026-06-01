import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PopiaService } from './popia.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import {
  GrantConsentDto,
  WithdrawConsentDto,
  ErasureRequestDto,
  UpdateRetentionSettingsDto,
} from './dto/consent.dto';

@Controller()
export class PopiaController {
  constructor(private readonly popia: PopiaService) {}

  // --- Public endpoints (guest-facing, no auth) ---

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/consent/grant')
  grantConsent(@Body() dto: GrantConsentDto, @Req() req: any) {
    return this.popia.grantConsent(
      dto.referenceNumber,
      dto.email,
      dto.consentTypes,
      req.ip,
      req.headers['user-agent'],
      dto.idNumber,
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/consent/withdraw')
  withdrawConsent(@Body() dto: WithdrawConsentDto) {
    return this.popia.withdrawConsent(
      dto.referenceNumber,
      dto.email,
      dto.consentTypes,
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('public/data/export')
  exportData(@Body() body: { referenceNumber: string; email: string }) {
    return this.popia.exportGuestData(body.referenceNumber, body.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('public/data/erasure')
  requestErasure(@Body() dto: ErasureRequestDto) {
    return this.popia.requestErasure(dto.referenceNumber, dto.email);
  }

  // --- Admin endpoints (auth required) ---

  @Get('properties/:propertyId/consents')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.GUESTS_VIEW)
  listConsents(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.popia.getPropertyConsents(propertyId, page ?? 1, limit ?? 20);
  }

  @Get('properties/:propertyId/consents/guest/:guestId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.GUESTS_VIEW)
  guestConsents(
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
  ) {
    return this.popia.getGuestConsents(guestId);
  }

  @Get('properties/:propertyId/data-retention')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_VIEW)
  getRetention(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.popia.getRetentionSettings(propertyId);
  }

  @Patch('properties/:propertyId/data-retention')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_MANAGE)
  updateRetention(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdateRetentionSettingsDto,
  ) {
    return this.popia.updateRetentionSettings(propertyId, dto);
  }
}
