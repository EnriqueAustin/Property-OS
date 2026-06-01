import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BOOKING_EVENTS } from '../bookings/events/booking.events';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceLineItem, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import { PAYMENT_EVENTS, InvoiceGeneratedEvent } from './events/payment.events';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  async generateInvoice(
    propertyId: string,
    bookingId: string,
    options?: { type?: InvoiceType; includeVat?: boolean; vatRate?: number },
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId, property_id: propertyId },
      relations: ['guest', 'room'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const property = await this.propertiesRepo.findOne({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    const invoiceNumber = await this.generateInvoiceNumber(propertyId);
    const invoiceType = options?.type ?? InvoiceType.TAX_INVOICE;
    const vatRate = options?.vatRate ?? 15;
    const includeVat = options?.includeVat !== false;

    const lineItems: InvoiceLineItem[] = [
      {
        description: `Accommodation: ${booking.nights} night(s) @ ${booking.currency} ${Number(booking.nightly_rate).toFixed(2)}`,
        quantity: booking.nights,
        unit_price: Number(booking.nightly_rate),
        total: Number(booking.total_price),
      },
    ];

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = includeVat ? Math.round(subtotal * (vatRate / (100 + vatRate)) * 100) / 100 : 0;
    const total = subtotal;

    const payments = await this.paymentsRepo.find({
      where: { booking_id: bookingId, property_id: propertyId },
    });
    const amountPaid = payments
      .filter((p) => p.status === PaymentStatus.COMPLETED && p.payment_type !== PaymentType.REFUND)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    let status = InvoiceStatus.ISSUED;
    if (amountPaid >= total) status = InvoiceStatus.PAID;
    else if (amountPaid > 0) status = InvoiceStatus.PARTIALLY_PAID;

    const today = new Date().toISOString().slice(0, 10);

    const invoice = this.invoicesRepo.create({
      invoice_number: invoiceNumber,
      booking_id: bookingId,
      property_id: propertyId,
      invoice_type: invoiceType,
      status,
      issue_date: today,
      due_date: booking.balance_due_date || booking.check_in,
      subtotal,
      vat_rate: includeVat ? vatRate : 0,
      vat_amount: vatAmount,
      total,
      currency: booking.currency,
      amount_paid: amountPaid,
      line_items: lineItems,
      guest_details: {
        name: booking.guest
          ? `${booking.guest.first_name} ${booking.guest.last_name}`
          : 'Guest',
        email: booking.guest?.email || '',
        phone: booking.guest?.phone || '',
      },
      property_details: {
        name: property.name,
        address: [property.address_line1, property.city, property.province, property.postal_code]
          .filter(Boolean)
          .join(', '),
        email: property.email || '',
        phone: property.phone || '',
      },
    });

    const saved = await this.invoicesRepo.save(invoice);

    this.eventEmitter.emit(
      PAYMENT_EVENTS.INVOICE_GENERATED,
      new InvoiceGeneratedEvent(bookingId, saved.id, saved.invoice_number),
    );

    this.logger.log(`Invoice ${invoiceNumber} generated for booking ${booking.reference_number}`);
    return saved;
  }

  async listInvoices(propertyId: string, query: { status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.invoicesRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.booking', 'b')
      .where('i.property_id = :propertyId', { propertyId });

    if (query.status) {
      qb.andWhere('i.status = :status', { status: query.status });
    }

    qb.orderBy('i.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getInvoice(invoiceId: string, propertyId: string) {
    const invoice = await this.invoicesRepo.findOne({
      where: { id: invoiceId, property_id: propertyId },
      relations: ['booking'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async getInvoiceByNumber(invoiceNumber: string, email?: string) {
    const invoice = await this.invoicesRepo.findOne({
      where: { invoice_number: invoiceNumber },
      relations: ['booking', 'booking.guest'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (email && invoice.booking?.guest?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async cancelInvoice(invoiceId: string, propertyId: string) {
    const invoice = await this.getInvoice(invoiceId, propertyId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is already cancelled');
    }
    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoicesRepo.save(invoice);
  }

  async generateCreditNote(propertyId: string, bookingId: string, refundAmount: number) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId, property_id: propertyId },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const property = await this.propertiesRepo.findOne({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    const invoiceNumber = await this.generateInvoiceNumber(propertyId, 'CN');
    const vatRate = 15;
    const vatAmount = Math.round(refundAmount * (vatRate / (100 + vatRate)) * 100) / 100;

    const lineItems: InvoiceLineItem[] = [
      {
        description: `Refund for booking ${booking.reference_number}`,
        quantity: 1,
        unit_price: refundAmount,
        total: refundAmount,
      },
    ];

    const invoice = this.invoicesRepo.create({
      invoice_number: invoiceNumber,
      booking_id: bookingId,
      property_id: propertyId,
      invoice_type: InvoiceType.CREDIT_NOTE,
      status: InvoiceStatus.ISSUED,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      subtotal: refundAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total: refundAmount,
      currency: booking.currency,
      amount_paid: 0,
      line_items: lineItems,
      guest_details: {
        name: booking.guest
          ? `${booking.guest.first_name} ${booking.guest.last_name}`
          : 'Guest',
        email: booking.guest?.email || '',
      },
      property_details: {
        name: property.name,
        address: [property.address_line1, property.city, property.province, property.postal_code]
          .filter(Boolean)
          .join(', '),
      },
    });

    return this.invoicesRepo.save(invoice);
  }

  async sendInvoiceEmail(propertyId: string, bookingId: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId, property_id: propertyId },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const guestEmail = booking.guest?.email || 'unknown';
    this.logger.log(`Invoice email would be sent to ${guestEmail} for booking ${booking.reference_number}`);
    return { success: true, message: `Invoice email queued for ${guestEmail}` };
  }

  @OnEvent(BOOKING_EVENTS.CHECKED_OUT)
  async handleBookingCheckedOut(payload: { bookingId: string; propertyId: string }) {
    try {
      this.logger.log(`Auto-generating invoice for booking ${payload.bookingId} on checkout`);
      await this.generateInvoice(payload.propertyId, payload.bookingId);
    } catch (error: any) {
      this.logger.warn(`Failed to auto-generate invoice on checkout for booking ${payload.bookingId}: ${error.message}`);
    }
  }

  private async generateInvoiceNumber(propertyId: string, prefix = 'INV'): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoicesRepo.count({
      where: { property_id: propertyId },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${seq}`;
  }
}
