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
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  ConfirmEftPaymentDto,
  InitiateEftPaymentDto,
  InitiatePayfastPaymentDto,
  RecordManualPaymentDto,
} from './dto/create-payment.dto';
import { UpdatePaymentSettingsDto } from './dto/payment-settings.dto';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // -- PayFast initiate (admin starts a payment for a booking) ----------------

  @Post('properties/:propertyId/payments/payfast')
  @UseGuards(PropertyGuard)
  initiatePayfast(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: InitiatePayfastPaymentDto,
  ) {
    return this.payments.initiatePayfast(propertyId, dto);
  }

  // -- PayFast ITN webhook (public, called by PayFast servers) ----------------

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 200 } })
  @Post('payments/payfast/itn')
  async handleItn(@Body() body: Record<string, string>, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    await this.payments.handlePayfastItn(body, ip);
    return 'OK';
  }

  // -- EFT initiate -----------------------------------------------------------

  @Post('properties/:propertyId/payments/eft')
  @UseGuards(PropertyGuard)
  initiateEft(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: InitiateEftPaymentDto,
  ) {
    return this.payments.initiateEft(propertyId, dto);
  }

  // -- EFT confirm (owner marks as received) ----------------------------------

  @Patch('properties/:propertyId/payments/:paymentId/confirm-eft')
  @UseGuards(PropertyGuard)
  confirmEft(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: ConfirmEftPaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.payments.confirmEft(paymentId, propertyId, userId, dto);
  }

  // -- Manual payment (cash / card swipe) -------------------------------------

  @Post('properties/:propertyId/payments/manual')
  @UseGuards(PropertyGuard)
  recordManual(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: RecordManualPaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.payments.recordManualPayment(propertyId, userId, dto);
  }

  // -- List payments for a property -------------------------------------------

  @Get('properties/:propertyId/payments')
  @UseGuards(PropertyGuard)
  listForProperty(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.payments.listPaymentsForProperty(propertyId, query);
  }

  // -- Payments for a specific booking ----------------------------------------

  @Get('properties/:propertyId/bookings/:bookingId/payments')
  @UseGuards(PropertyGuard)
  listForBooking(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.payments.listPaymentsForBooking(bookingId, propertyId);
  }

  // -- Payment summary for a booking ------------------------------------------

  @Get('properties/:propertyId/bookings/:bookingId/payment-summary')
  @UseGuards(PropertyGuard)
  paymentSummary(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.payments.getBookingPaymentSummary(bookingId, propertyId);
  }

  // -- Payment settings -------------------------------------------------------

  @Get('properties/:propertyId/payment-settings')
  @UseGuards(PropertyGuard)
  getSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.payments.getSettings(propertyId);
  }

  @Patch('properties/:propertyId/payment-settings')
  @UseGuards(PropertyGuard)
  updateSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.payments.updateSettings(propertyId, dto);
  }
}
