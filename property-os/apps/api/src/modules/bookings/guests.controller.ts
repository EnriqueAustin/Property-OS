import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { GuestsService } from './guests.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { UpdateGuestDto } from './dto/guest.dto';

@Controller()
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get('properties/:propertyId/guests')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.GUESTS_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: { search?: string; page?: number; limit?: number },
  ) {
    return this.guests.listGuests(propertyId, query);
  }

  @Get('properties/:propertyId/guests/:guestId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.GUESTS_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
  ) {
    return this.guests.getGuest(guestId);
  }

  @Patch('properties/:propertyId/guests/:guestId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.GUESTS_MANAGE)
  update(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guests.updateGuest(guestId, dto);
  }

  @Get('properties/:propertyId/guests/export/marketing')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.GUESTS_VIEW)
  async exportMarketing(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Res() res: Response,
  ) {
    const csv = await this.guests.exportMarketingList(propertyId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="guest-marketing-list.csv"');
    res.send(csv);
  }
}
