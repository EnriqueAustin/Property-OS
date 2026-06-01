import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PromosService } from './promos.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ValidatePromoCodeDto } from './dto/promo-code.dto';

@Controller()
export class PromosController {
  constructor(private readonly promos: PromosService) {}

  @Post('properties/:propertyId/promo-codes')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PRICING_MANAGE)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreatePromoCodeDto,
  ) {
    return this.promos.create(propertyId, dto);
  }

  @Get('properties/:propertyId/promo-codes')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PRICING_VIEW)
  list(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.promos.list(propertyId);
  }

  @Get('properties/:propertyId/promo-codes/:promoId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PRICING_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('promoId', new ParseUUIDPipe()) promoId: string,
  ) {
    return this.promos.getOne(propertyId, promoId);
  }

  @Patch('properties/:propertyId/promo-codes/:promoId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PRICING_MANAGE)
  update(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('promoId', new ParseUUIDPipe()) promoId: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promos.update(propertyId, promoId, dto);
  }

  @Delete('properties/:propertyId/promo-codes/:promoId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PRICING_MANAGE)
  remove(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('promoId', new ParseUUIDPipe()) promoId: string,
  ) {
    return this.promos.remove(propertyId, promoId);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('public/promo-codes/validate')
  validateCode(@Body() dto: ValidatePromoCodeDto & { propertySlug: string }) {
    return this.promos.validateBySlug(dto.propertySlug, dto.code, dto.nights, dto.totalAmount);
  }
}
