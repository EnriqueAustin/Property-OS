import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PublicBookingDto, PublicAvailabilityQueryDto } from './dto/public-booking.dto';
import {
  CancelBookingDto,
  UpdateBookingDto,
  UpdateStatusDto,
} from './dto/update-booking.dto';

@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // --- Admin endpoints (auth required) ------------------------------------

  @Post('properties/:propertyId/bookings/create')
  @UseGuards(PropertyGuard)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateBookingDto,
  ) {
    dto.propertyId = propertyId;
    return this.bookings.createBooking(dto);
  }

  @Get('properties/:propertyId/bookings')
  @UseGuards(PropertyGuard)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.bookings.listBookings(propertyId, query);
  }

  @Get('properties/:propertyId/bookings/:bookingId')
  @UseGuards(PropertyGuard)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.bookings.getBooking(bookingId);
  }

  @Patch('properties/:propertyId/bookings/:bookingId')
  @UseGuards(PropertyGuard)
  update(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.updateBooking(bookingId, dto);
  }

  @Patch('properties/:propertyId/bookings/:bookingId/status')
  @UseGuards(PropertyGuard)
  updateStatus(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.bookings.updateStatus(bookingId, dto);
  }

  @Post('properties/:propertyId/bookings/:bookingId/cancel')
  @UseGuards(PropertyGuard)
  cancel(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancelBooking(bookingId, dto);
  }

  // --- Public endpoints (no auth) -----------------------------------------

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('public/properties/:slug')
  publicProperty(@Param('slug') slug: string) {
    return this.bookings.getPublicProperty(slug);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('public/properties/:slug/availability')
  publicAvailability(
    @Param('slug') slug: string,
    @Query() q: PublicAvailabilityQueryDto,
  ) {
    return this.bookings.checkPublicAvailability(
      slug,
      q.checkIn,
      q.checkOut,
      q.guests,
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('public/bookings')
  publicBooking(@Body() dto: PublicBookingDto) {
    return this.bookings.createPublicBooking(dto);
  }
}
