import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Payment, PaymentProvider, PaymentStatus, PaymentType } from './entities/payment.entity';
import { PaymentSettings } from './entities/payment-settings.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import {
  ConfirmEftPaymentDto,
  InitiateEftPaymentDto,
  InitiatePayfastPaymentDto,
  RecordManualPaymentDto,
} from './dto/create-payment.dto';
import { UpdatePaymentSettingsDto } from './dto/payment-settings.dto';
import {
  buildPayfastRedirectUrl,
  verifyPayfastSignature,
} from './utils/payfast.util';
import { PAYMENT_EVENTS, PaymentCompletedEvent } from './events/payment.events';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(PaymentSettings)
    private settingsRepo: Repository<PaymentSettings>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  // -- PayFast: initiate redirect ---------------------------------------------

  async initiatePayfast(propertyId: string, dto: InitiatePayfastPaymentDto) {
    const booking = await this.getBookingForProperty(dto.bookingId, propertyId);
    const settings = await this.getSettings(propertyId);

    if (!settings.payfast_enabled) {
      throw new BadRequestException('PayFast is not enabled for this property');
    }

    const amount = dto.amount ?? this.calcAmount(booking, dto.paymentType);

    const payment = this.paymentsRepo.create({
      booking_id: booking.id,
      property_id: propertyId,
      amount,
      currency: booking.currency,
      payment_type: dto.paymentType,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.PAYFAST,
    });
    const saved = await this.paymentsRepo.save(payment);

    const baseUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    const apiUrl = this.config.get<string>('API_URL') || 'http://localhost:3001';

    const { url, signature } = buildPayfastRedirectUrl(
      {
        merchant_id: settings.payfast_merchant_id!,
        merchant_key: settings.payfast_merchant_key!,
        return_url: `${baseUrl}/bookings/${booking.reference_number}/payment-complete`,
        cancel_url: `${baseUrl}/bookings/${booking.reference_number}/payment-cancelled`,
        notify_url: `${apiUrl}/payments/payfast/itn`,
        name_first: booking.guest?.first_name || 'Guest',
        name_last: booking.guest?.last_name || '',
        email_address: booking.guest?.email || '',
        m_payment_id: saved.id,
        amount: amount.toFixed(2),
        item_name: `Booking ${booking.reference_number}`,
        item_description: `${dto.paymentType} for ${booking.nights} night(s)`,
      },
      settings.payfast_passphrase,
      settings.payfast_sandbox,
    );

    saved.provider_data = { signature };
    await this.paymentsRepo.save(saved);

    return {
      paymentId: saved.id,
      redirectUrl: url,
      amount,
      sandbox: settings.payfast_sandbox,
    };
  }

  // -- PayFast ITN webhook (Instant Transaction Notification) -----------------

  async handlePayfastItn(body: Record<string, string>, sourceIp: string) {
    this.logger.log(`PayFast ITN received from ${sourceIp}`);

    const paymentId = body.m_payment_id;
    if (!paymentId) {
      this.logger.warn('ITN missing m_payment_id');
      return;
    }

    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      this.logger.warn(`ITN for unknown payment: ${paymentId}`);
      return;
    }

    const settings = await this.getSettings(payment.property_id);
    const signatureValid = verifyPayfastSignature(
      body,
      settings.payfast_passphrase,
    );

    if (!signatureValid) {
      this.logger.warn(`ITN signature mismatch for payment ${paymentId}`);
      payment.status = PaymentStatus.FAILED;
      payment.failed_at = new Date();
      payment.provider_data = { ...payment.provider_data, itn: body, error: 'signature_mismatch' };
      await this.paymentsRepo.save(payment);
      return;
    }

    const payfastStatus = body.payment_status;
    payment.provider_ref = body.pf_payment_id;
    payment.provider_data = { ...payment.provider_data, itn: body };

    if (payfastStatus === 'COMPLETE') {
      payment.status = PaymentStatus.COMPLETED;
      payment.paid_at = new Date();
      this.logger.log(`Payment ${paymentId} completed via PayFast`);
      this.eventEmitter.emit(
        PAYMENT_EVENTS.COMPLETED,
        new PaymentCompletedEvent(payment.booking_id, Number(payment.amount), 'PayFast'),
      );
    } else if (payfastStatus === 'FAILED') {
      payment.status = PaymentStatus.FAILED;
      payment.failed_at = new Date();
    } else {
      payment.status = PaymentStatus.PROCESSING;
    }

    await this.paymentsRepo.save(payment);
  }

  // -- EFT: initiate ----------------------------------------------------------

  async initiateEft(propertyId: string, dto: InitiateEftPaymentDto) {
    const booking = await this.getBookingForProperty(dto.bookingId, propertyId);
    const settings = await this.getSettings(propertyId);

    if (!settings.eft_enabled) {
      throw new BadRequestException('EFT is not enabled for this property');
    }

    const amount = dto.amount ?? this.calcAmount(booking, dto.paymentType);

    const payment = this.paymentsRepo.create({
      booking_id: booking.id,
      property_id: propertyId,
      amount,
      currency: booking.currency,
      payment_type: dto.paymentType,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.EFT,
      eft_reference: booking.reference_number,
    });
    const saved = await this.paymentsRepo.save(payment);

    return {
      paymentId: saved.id,
      amount,
      bankDetails: {
        bankName: settings.eft_bank_name,
        accountHolder: settings.eft_account_holder,
        accountNumber: settings.eft_account_number,
        branchCode: settings.eft_branch_code,
        accountType: settings.eft_account_type,
        reference: booking.reference_number,
      },
    };
  }

  // -- EFT: owner confirms receipt --------------------------------------------

  async confirmEft(
    paymentId: string,
    propertyId: string,
    userId: string,
    dto: ConfirmEftPaymentDto,
  ) {
    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId, property_id: propertyId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not in pending state');
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.paid_at = new Date();
    payment.eft_confirmed_by = userId;
    if (dto.eftReference) payment.eft_reference = dto.eftReference;
    if (dto.notes) payment.notes = dto.notes;

    const saved = await this.paymentsRepo.save(payment);
    this.eventEmitter.emit(
      PAYMENT_EVENTS.COMPLETED,
      new PaymentCompletedEvent(saved.booking_id, Number(saved.amount), 'EFT'),
    );
    return saved;
  }

  // -- Manual payment (cash, card swipe, etc.) --------------------------------

  async recordManualPayment(propertyId: string, userId: string, dto: RecordManualPaymentDto) {
    const booking = await this.getBookingForProperty(dto.bookingId, propertyId);

    const payment = this.paymentsRepo.create({
      booking_id: booking.id,
      property_id: propertyId,
      amount: dto.amount,
      currency: booking.currency,
      payment_type: dto.paymentType,
      status: PaymentStatus.COMPLETED,
      provider: dto.provider,
      paid_at: new Date(),
      eft_confirmed_by: userId,
      notes: dto.notes,
    });

    const saved = await this.paymentsRepo.save(payment);
    this.eventEmitter.emit(
      PAYMENT_EVENTS.COMPLETED,
      new PaymentCompletedEvent(saved.booking_id, Number(saved.amount), dto.provider),
    );
    return saved;
  }

  // -- List payments for a booking --------------------------------------------

  async listPaymentsForBooking(bookingId: string, propertyId: string) {
    return this.paymentsRepo.find({
      where: { booking_id: bookingId, property_id: propertyId },
      order: { created_at: 'DESC' },
    });
  }

  // -- List payments for a property -------------------------------------------

  async listPaymentsForProperty(
    propertyId: string,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.paymentsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.booking', 'b')
      .where('p.property_id = :propertyId', { propertyId });

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    qb.orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // -- Payment summary for a booking ------------------------------------------

  async getBookingPaymentSummary(bookingId: string, propertyId: string) {
    const booking = await this.getBookingForProperty(bookingId, propertyId);
    const payments = await this.paymentsRepo.find({
      where: { booking_id: bookingId, property_id: propertyId },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.COMPLETED && p.payment_type !== PaymentType.REFUND)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRefunded = payments
      .filter((p) => p.payment_type === PaymentType.REFUND && p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalOwed = Number(booking.total_price);
    const balance = totalOwed - totalPaid + totalRefunded;

    return {
      bookingId,
      totalOwed,
      totalPaid,
      totalRefunded,
      balance,
      fullyPaid: balance <= 0,
      payments,
    };
  }

  // -- Settings ---------------------------------------------------------------

  async getSettings(propertyId: string): Promise<PaymentSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { property_id: propertyId },
    });
    if (!settings) {
      settings = this.settingsRepo.create({ property_id: propertyId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(propertyId: string, dto: UpdatePaymentSettingsDto) {
    let settings = await this.getSettings(propertyId);

    if (dto.payfastMerchantId !== undefined) settings.payfast_merchant_id = dto.payfastMerchantId;
    if (dto.payfastMerchantKey !== undefined) settings.payfast_merchant_key = dto.payfastMerchantKey;
    if (dto.payfastPassphrase !== undefined) settings.payfast_passphrase = dto.payfastPassphrase;
    if (dto.payfastSandbox !== undefined) settings.payfast_sandbox = dto.payfastSandbox;
    if (dto.payfastEnabled !== undefined) settings.payfast_enabled = dto.payfastEnabled;
    if (dto.eftEnabled !== undefined) settings.eft_enabled = dto.eftEnabled;
    if (dto.eftBankName !== undefined) settings.eft_bank_name = dto.eftBankName;
    if (dto.eftAccountHolder !== undefined) settings.eft_account_holder = dto.eftAccountHolder;
    if (dto.eftAccountNumber !== undefined) settings.eft_account_number = dto.eftAccountNumber;
    if (dto.eftBranchCode !== undefined) settings.eft_branch_code = dto.eftBranchCode;
    if (dto.eftAccountType !== undefined) settings.eft_account_type = dto.eftAccountType;

    return this.settingsRepo.save(settings);
  }

  // -- Helpers ----------------------------------------------------------------

  private async getBookingForProperty(bookingId: string, propertyId: string): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId, property_id: propertyId },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private calcAmount(booking: Booking, paymentType: PaymentType): number {
    const total = Number(booking.total_price);
    if (paymentType === PaymentType.DEPOSIT) {
      return Math.ceil(total * 0.5 * 100) / 100; // 50% default deposit
    }
    return total;
  }
}
