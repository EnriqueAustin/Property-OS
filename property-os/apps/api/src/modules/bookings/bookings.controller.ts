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
import { AbandonedBookingService } from './abandoned-booking.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PublicBookingDto, PublicAvailabilityQueryDto, OnlineCheckInDto } from './dto/public-booking.dto';
import {
  CancelBookingDto,
  UpdateBookingDto,
  UpdateStatusDto,
} from './dto/update-booking.dto';

@Controller()
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly abandonedBookings: AbandonedBookingService,
  ) {}

  // --- Admin endpoints (auth required) ------------------------------------

  @Post('properties/:propertyId/bookings/create')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateBookingDto,
  ) {
    dto.propertyId = propertyId;
    return this.bookings.createBooking(dto);
  }

  @Get('properties/:propertyId/bookings')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.bookings.listBookings(propertyId, query);
  }

  @Get('properties/:propertyId/bookings/:bookingId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.bookings.getBooking(bookingId);
  }

  @Get('properties/:propertyId/bookings/group/:groupId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  getGroup(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ) {
    return this.bookings.getBookingGroup(groupId);
  }

  @Patch('properties/:propertyId/bookings/:bookingId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  update(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.updateBooking(bookingId, dto);
  }

  @Patch('properties/:propertyId/bookings/:bookingId/status')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  updateStatus(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.bookings.updateStatus(bookingId, dto);
  }

  @Post('properties/:propertyId/bookings/:bookingId/cancel')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  cancel(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancelBooking(bookingId, dto);
  }

  @Post('properties/:propertyId/bookings/group/:groupId/cancel')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  cancelGroup(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancelBookingGroup(groupId, dto);
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
  @Get('public/properties/:slug/guestbook')
  publicGuestbook(@Param('slug') slug: string) {
    return this.bookings.getGuestbook(slug);
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

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/bookings/lookup')
  lookupBooking(
    @Body() body: { referenceNumber: string; email: string },
  ) {
    return this.bookings.lookupBooking(body.referenceNumber, body.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('public/payments/initiate')
  publicPaymentInitiate(
    @Body() body: { referenceNumber: string; email: string; paymentType: string },
  ) {
    return this.bookings.initiatePublicPayment(body.referenceNumber, body.email, body.paymentType);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('public/bookings/cancel')
  guestCancel(
    @Body() body: { referenceNumber: string; email: string; reason?: string; cancelGroup?: boolean },
  ) {
    return this.bookings.guestCancelBooking(
      body.referenceNumber,
      body.email,
      body.reason,
      body.cancelGroup,
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('public/bookings/check-in')
  onlineCheckIn(@Body() dto: OnlineCheckInDto) {
    return this.bookings.onlineCheckIn(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  // --- Abandoned booking recovery ---

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('public/bookings/track-progress')
  trackBookingProgress(
    @Body()
    body: {
      propertyId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      checkIn?: string;
      checkOut?: string;
      roomTypeId?: string;
      guestCount?: number;
      stepReached: number;
      estimatedTotal?: number;
    },
  ) {
    return this.abandonedBookings.trackAbandonment(body);
  }

  @Get('properties/:propertyId/abandoned-bookings/stats')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.REPORTS_VIEW)
  abandonedStats(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.abandonedBookings.getStats(propertyId);
  }

  @Get('properties/:propertyId/abandoned-bookings')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  abandonedList(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('status') status?: string,
  ) {
    return this.abandonedBookings.listAbandoned(propertyId, status);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Patch('public/bookings/modify')
  guestModifyBooking(
    @Body()
    body: {
      referenceNumber: string;
      email: string;
      checkIn?: string;
      checkOut?: string;
      guestCount?: number;
      specialRequests?: string;
    },
  ) {
    return this.bookings.guestModifyBooking(
      body.referenceNumber,
      body.email,
      {
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guestCount: body.guestCount,
        specialRequests: body.specialRequests,
      },
    );
  }
}
