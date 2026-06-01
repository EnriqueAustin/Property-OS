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
import { CurrencyService } from './currency.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import {
  ConfirmEftPaymentDto,
  InitiateEftPaymentDto,
  InitiatePayfastPaymentDto,
  RecordManualPaymentDto,
} from './dto/create-payment.dto';
import { UpdatePaymentSettingsDto } from './dto/payment-settings.dto';

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly currency: CurrencyService,
  ) {}

  // -- PayFast initiate (admin starts a payment for a booking) ----------------

  @Post('properties/:propertyId/payments/payfast')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  initiatePayfast(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: InitiatePayfastPaymentDto,
  ) {
    return this.payments.initiatePayfast(propertyId, dto);
  }

  // -- SnapScan via PayFast (uses PayFast with payment_method=sc) --------------

  @Post('properties/:propertyId/payments/snapscan')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  initiateSnapscan(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: InitiatePayfastPaymentDto,
  ) {
    return this.payments.initiateSnapscan(propertyId, dto);
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
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  initiateEft(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: InitiateEftPaymentDto,
  ) {
    return this.payments.initiateEft(propertyId, dto);
  }

  // -- EFT confirm (owner marks as received) ----------------------------------

  @Patch('properties/:propertyId/payments/:paymentId/confirm-eft')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
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
  @RequirePermission(Permission.PAYMENTS_MANAGE)
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
  @RequirePermission(Permission.PAYMENTS_VIEW)
  listForProperty(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.payments.listPaymentsForProperty(propertyId, query);
  }

  // -- Payments for a specific booking ----------------------------------------

  @Get('properties/:propertyId/bookings/:bookingId/payments')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_VIEW)
  listForBooking(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.payments.listPaymentsForBooking(bookingId, propertyId);
  }

  // -- Payment summary for a booking ------------------------------------------

  @Get('properties/:propertyId/bookings/:bookingId/payment-summary')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_VIEW)
  paymentSummary(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.payments.getBookingPaymentSummary(bookingId, propertyId);
  }

  // -- Outstanding balances (upcoming bookings with balance due) ---------------

  @Get('properties/:propertyId/outstanding-balances')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_VIEW)
  outstandingBalances(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.payments.getOutstandingBalances(propertyId);
  }

  // -- Payment link generation ------------------------------------------------

  @Post('properties/:propertyId/bookings/:bookingId/payment-link')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  generatePaymentLink(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.payments.generatePaymentLink(propertyId, bookingId);
  }

  // -- Payment settings -------------------------------------------------------

  @Get('properties/:propertyId/payment-settings')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_VIEW)
  getSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.payments.getSettingsSafe(propertyId);
  }

  @Patch('properties/:propertyId/payment-settings')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_MANAGE)
  updateSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.payments.updateSettings(propertyId, dto);
  }

  // -- Currency ---------------------------------------------------------------

  @Public()
  @Get('currencies')
  supportedCurrencies() {
    return this.currency.getSupportedCurrencies();
  }

  @Public()
  @Get('currencies/rates')
  exchangeRates(@Query('base') base?: string) {
    return this.currency.getExchangeRates(base || 'ZAR');
  }

  @Public()
  @Get('currencies/convert')
  async convertCurrency(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.currency.convert(Number(amount), from, to);
  }
}
