import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PackagesService } from './packages.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import {
  AddPackageToBookingDto,
  CreatePackageDto,
  UpdatePackageDto,
} from './dto/package.dto';

@Controller()
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  // --- Admin CRUD ---

  @Post('properties/:propertyId/packages')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.packages.create(propertyId, dto);
  }

  @Get('properties/:propertyId/packages')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.packages.list(propertyId, { activeOnly: activeOnly === 'true' });
  }

  @Get('properties/:propertyId/packages/:packageId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
  ) {
    return this.packages.getOne(packageId, propertyId);
  }

  @Patch('properties/:propertyId/packages/:packageId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  update(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packages.update(packageId, propertyId, dto);
  }

  @Delete('properties/:propertyId/packages/:packageId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  delete(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
  ) {
    return this.packages.delete(packageId, propertyId);
  }

  // --- Check-in upselling prompts ---

  @Get('properties/:propertyId/bookings/:bookingId/upsell-prompts')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  getUpsellPrompts(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.packages.getCheckinUpsellPrompts(propertyId, bookingId);
  }

  // --- Booking package management (admin) ---

  @Post('properties/:propertyId/bookings/:bookingId/packages')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  addToBooking(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: AddPackageToBookingDto,
  ) {
    return this.packages.addToBooking(propertyId, bookingId, dto, 'during_stay');
  }

  @Get('properties/:propertyId/bookings/:bookingId/packages')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  getBookingPackages(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.packages.getBookingPackages(bookingId, propertyId);
  }

  @Delete('properties/:propertyId/booking-packages/:bookingPackageId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  removeFromBooking(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingPackageId', new ParseUUIDPipe()) bookingPackageId: string,
  ) {
    return this.packages.removeFromBooking(bookingPackageId, propertyId);
  }

  // --- Public endpoints ---

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('public/properties/:slug/packages')
  publicPackages(
    @Param('slug') slug: string,
    @Query('stage') stage?: string,
  ) {
    return this.packages.getPublicPackages(slug, (stage as any) || 'booking');
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/bookings/packages')
  addPackagePublic(
    @Body() body: {
      referenceNumber: string;
      email: string;
      packageId: string;
      quantity?: number;
      stage?: string;
    },
  ) {
    return this.packages.addToBookingPublic(
      body.referenceNumber,
      body.email,
      body.packageId,
      body.quantity ?? 1,
      (body.stage as any) || 'booking',
    );
  }
}
