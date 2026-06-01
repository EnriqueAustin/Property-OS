import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingService } from './accounting.service';
import { PAYMENT_EVENTS, InvoiceGeneratedEvent, PaymentCompletedEvent, PaymentRefundedEvent } from '../payments/events/payment.events';
import { BOOKING_EVENTS, BookingCancelledEvent } from '../bookings/events/booking.events';
import { Invoice } from '../payments/entities/invoice.entity';
import { Payment, PaymentStatus, PaymentType } from '../payments/entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class AccountingEventListener {
  private readonly logger = new Logger(AccountingEventListener.name);

  constructor(
    private readonly accountingService: AccountingService,
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
  ) {}

  @OnEvent(PAYMENT_EVENTS.INVOICE_GENERATED)
  async onInvoiceGenerated(event: InvoiceGeneratedEvent) {
    try {
      const invoice = await this.invoicesRepo.findOne({
        where: { id: event.invoiceId },
      });
      if (!invoice) return;

      const connections = await this.accountingService.getActiveConnections(invoice.property_id);
      for (const conn of connections) {
        if (!conn.settings?.sync_invoices) continue;
        if (!conn.settings?.auto_sync_enabled) continue;

        try {
          await this.accountingService.syncInvoice(conn.id, invoice.id);
        } catch (err: any) {
          this.logger.error(
            `Auto-sync invoice ${invoice.invoice_number} to ${conn.provider_type} failed: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`onInvoiceGenerated handler error: ${err.message}`);
    }
  }

  @OnEvent(PAYMENT_EVENTS.COMPLETED)
  async onPaymentCompleted(event: PaymentCompletedEvent) {
    try {
      const payments = await this.paymentsRepo.find({
        where: { booking_id: event.bookingId, status: PaymentStatus.COMPLETED },
        order: { created_at: 'DESC' },
        take: 1,
      });
      const payment = payments[0];
      if (!payment) return;

      const connections = await this.accountingService.getActiveConnections(payment.property_id);
      for (const conn of connections) {
        if (!conn.settings?.sync_payments) continue;
        if (!conn.settings?.auto_sync_enabled) continue;

        try {
          await this.accountingService.syncPayment(conn.id, payment.id);
        } catch (err: any) {
          this.logger.error(
            `Auto-sync payment for booking ${event.bookingId} to ${conn.provider_type} failed: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`onPaymentCompleted handler error: ${err.message}`);
    }
  }

  @OnEvent(PAYMENT_EVENTS.REFUNDED)
  async onPaymentRefunded(event: PaymentRefundedEvent) {
    try {
      const booking = await this.bookingsRepo.findOne({
        where: { id: event.bookingId },
      });
      if (!booking) return;

      const connections = await this.accountingService.getActiveConnections(booking.property_id);
      for (const conn of connections) {
        if (!conn.settings?.sync_credit_notes) continue;
        if (!conn.settings?.auto_sync_enabled) continue;

        try {
          await this.accountingService.syncCreditNote(conn.id, booking.id, event.amount);
        } catch (err: any) {
          this.logger.error(
            `Auto-sync credit note for booking ${event.bookingId} to ${conn.provider_type} failed: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`onPaymentRefunded handler error: ${err.message}`);
    }
  }

  @OnEvent(BOOKING_EVENTS.CANCELLED)
  async onBookingCancelled(event: BookingCancelledEvent) {
    try {
      const booking = await this.bookingsRepo.findOne({
        where: { id: event.bookingId },
      });
      if (!booking) return;

      const propertyId = event.propertyId || booking.property_id;
      const connections = await this.accountingService.getActiveConnections(propertyId);

      const invoices = await this.invoicesRepo.find({
        where: { booking_id: booking.id },
      });

      for (const conn of connections) {
        if (!conn.settings?.auto_sync_enabled) continue;

        for (const invoice of invoices) {
          try {
            await this.accountingService.voidInvoiceInAccounting(conn.id, invoice.id);
          } catch (err: any) {
            this.logger.error(
              `Auto-void invoice ${invoice.invoice_number} in ${conn.provider_type} failed: ${err.message}`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`onBookingCancelled handler error: ${err.message}`);
    }
  }
}
