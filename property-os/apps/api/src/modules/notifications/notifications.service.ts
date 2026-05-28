import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationTemplate,
  RecipientType,
} from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import {
  BookingTemplateData,
  bookingConfirmationEmail,
  bookingCancellationEmail,
  bookingModifiedEmail,
  newBookingAlertEmail,
  paymentReceivedEmail,
} from './templates/email.templates';
import {
  BOOKING_EVENTS,
  BookingCreatedEvent,
  BookingCancelledEvent,
  BookingModifiedEvent,
} from '../bookings/events/booking.events';
import {
  PAYMENT_EVENTS,
  PaymentCompletedEvent,
} from '../payments/events/payment.events';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    @InjectRepository(NotificationSettings)
    private settingsRepo: Repository<NotificationSettings>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    private emailProvider: EmailProvider,
    private whatsappProvider: WhatsappProvider,
  ) {}

  // -- Event listeners ---------------------------------------------------------

  @OnEvent(BOOKING_EVENTS.CREATED)
  async handleBookingCreated(event: BookingCreatedEvent) {
    this.logger.log(`Handling booking.created event for ${event.bookingId}`);
    await this.onBookingCreated(event.bookingId);
  }

  @OnEvent(BOOKING_EVENTS.CANCELLED)
  async handleBookingCancelled(event: BookingCancelledEvent) {
    this.logger.log(`Handling booking.cancelled event for ${event.bookingId}`);
    await this.onBookingCancelled(event.bookingId, event.reason);
  }

  @OnEvent(BOOKING_EVENTS.MODIFIED)
  async handleBookingModified(event: BookingModifiedEvent) {
    this.logger.log(`Handling booking.modified event for ${event.bookingId}`);
    await this.onBookingModified(event.bookingId, event.changes);
  }

  @OnEvent(PAYMENT_EVENTS.COMPLETED)
  async handlePaymentCompleted(event: PaymentCompletedEvent) {
    this.logger.log(`Handling payment.completed event for booking ${event.bookingId}`);
    await this.onPaymentReceived(event.bookingId, event.amount, event.method);
  }

  // -- High-level event triggers ----------------------------------------------

  async onBookingCreated(bookingId: string) {
    const booking = await this.loadBooking(bookingId);
    const property = await this.propertiesRepo.findOne({ where: { id: booking.property_id } });
    if (!property) return;

    const templateData = this.buildTemplateData(booking, property);

    // Email to guest
    if (booking.guest?.email) {
      const { subject, html } = bookingConfirmationEmail(templateData);
      await this.sendEmail(
        property.id,
        booking.id,
        NotificationTemplate.BOOKING_CONFIRMATION,
        RecipientType.GUEST,
        booking.guest.email,
        subject,
        html,
      );
    }

    // WhatsApp to guest
    if (booking.guest?.phone) {
      await this.sendWhatsapp(
        property.id,
        booking.id,
        NotificationTemplate.BOOKING_CONFIRMATION,
        RecipientType.GUEST,
        booking.guest.phone,
        'booking_confirmation',
        {
          guest_name: `${booking.guest.first_name} ${booking.guest.last_name}`,
          property: property.name,
          ref: booking.reference_number,
          check_in: booking.check_in,
          check_out: booking.check_out,
        },
      );
    }

    // Email alert to owner
    if (property.email) {
      const { subject, html } = newBookingAlertEmail({
        ...templateData,
        guestEmail: booking.guest?.email,
        guestPhone: booking.guest?.phone,
      });
      await this.sendEmail(
        property.id,
        booking.id,
        NotificationTemplate.NEW_BOOKING_ALERT,
        RecipientType.OWNER,
        property.email,
        subject,
        html,
      );
    }
  }

  async onBookingCancelled(bookingId: string, reason?: string) {
    const booking = await this.loadBooking(bookingId);
    const property = await this.propertiesRepo.findOne({ where: { id: booking.property_id } });
    if (!property) return;

    const templateData = this.buildTemplateData(booking, property);

    if (booking.guest?.email) {
      const { subject, html } = bookingCancellationEmail({ ...templateData, reason });
      await this.sendEmail(
        property.id,
        booking.id,
        NotificationTemplate.BOOKING_CANCELLATION,
        RecipientType.GUEST,
        booking.guest.email,
        subject,
        html,
      );
    }

    if (booking.guest?.phone) {
      await this.sendWhatsapp(
        property.id,
        booking.id,
        NotificationTemplate.BOOKING_CANCELLATION,
        RecipientType.GUEST,
        booking.guest.phone,
        'booking_cancellation',
        {
          guest_name: `${booking.guest.first_name} ${booking.guest.last_name}`,
          property: property.name,
          ref: booking.reference_number,
        },
      );
    }
  }

  async onBookingModified(bookingId: string, changes: Record<string, { old: any; new: any }>) {
    const booking = await this.loadBooking(bookingId);
    const property = await this.propertiesRepo.findOne({ where: { id: booking.property_id } });
    if (!property) return;

    const templateData = this.buildTemplateData(booking, property);

    const fieldLabels: Record<string, string> = {
      check_in: 'Check-in date',
      check_out: 'Check-out date',
      guest_count: 'Number of guests',
      special_requests: 'Special requests',
    };

    const changesHtml = Object.entries(changes)
      .map(([key, { old: oldVal, new: newVal }]) => {
        const label = fieldLabels[key] || key;
        return `<p style="margin: 4px 0; color: #475569;"><strong>${label}:</strong> ${oldVal || '—'} → ${newVal || '—'}</p>`;
      })
      .join('');

    if (booking.guest?.email) {
      const { subject, html } = bookingModifiedEmail({ ...templateData, changes: changesHtml });
      await this.sendEmail(
        property.id,
        booking.id,
        NotificationTemplate.BOOKING_MODIFIED,
        RecipientType.GUEST,
        booking.guest.email,
        subject,
        html,
      );
    }

    if (property.email) {
      const { subject, html } = bookingModifiedEmail({ ...templateData, changes: changesHtml });
      await this.sendEmail(
        property.id,
        booking.id,
        NotificationTemplate.BOOKING_MODIFIED,
        RecipientType.OWNER,
        property.email,
        `Booking Modified — ${booking.reference_number}`,
        html,
      );
    }
  }

  async onPaymentReceived(bookingId: string, amount: number, method: string) {
    const booking = await this.loadBooking(bookingId);
    const property = await this.propertiesRepo.findOne({ where: { id: booking.property_id } });
    if (!property) return;

    const templateData = this.buildTemplateData(booking, property);

    if (booking.guest?.email) {
      const { subject, html } = paymentReceivedEmail({
        ...templateData,
        amountPaid: amount.toFixed(2),
        paymentMethod: method,
      });
      await this.sendEmail(
        property.id,
        booking.id,
        NotificationTemplate.PAYMENT_RECEIVED,
        RecipientType.GUEST,
        booking.guest.email,
        subject,
        html,
      );
    }
  }

  // -- List notifications -----------------------------------------------------

  async listForProperty(
    propertyId: string,
    query: { status?: string; channel?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.notificationsRepo
      .createQueryBuilder('n')
      .where('n.property_id = :propertyId', { propertyId });

    if (query.status) qb.andWhere('n.status = :status', { status: query.status });
    if (query.channel) qb.andWhere('n.channel = :channel', { channel: query.channel });

    qb.orderBy('n.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listForBooking(bookingId: string, propertyId: string) {
    return this.notificationsRepo.find({
      where: { booking_id: bookingId, property_id: propertyId },
      order: { created_at: 'DESC' },
    });
  }

  // -- Resend a notification --------------------------------------------------

  async resend(notificationId: string, propertyId: string) {
    const notification = await this.notificationsRepo.findOne({
      where: { id: notificationId, property_id: propertyId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.channel === NotificationChannel.EMAIL && notification.recipient_email) {
      const result = await this.emailProvider.send({
        to: notification.recipient_email,
        subject: notification.subject || '',
        html: notification.body || '',
      });
      notification.status = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
      notification.sent_at = result.success ? new Date() : notification.sent_at;
      notification.error_message = result.error ?? null as any;
      notification.provider_ref = result.providerRef || notification.provider_ref;
    }

    return this.notificationsRepo.save(notification);
  }

  // -- Internal send helpers --------------------------------------------------

  private async sendEmail(
    propertyId: string,
    bookingId: string,
    template: NotificationTemplate,
    recipientType: RecipientType,
    to: string,
    subject: string,
    html: string,
  ) {
    const notification = this.notificationsRepo.create({
      property_id: propertyId,
      booking_id: bookingId,
      channel: NotificationChannel.EMAIL,
      template,
      recipient_type: recipientType,
      recipient_email: to,
      subject,
      body: html,
      status: NotificationStatus.PENDING,
    });
    const saved = await this.notificationsRepo.save(notification);

    try {
      const result = await this.emailProvider.send({ to, subject, html });
      saved.status = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
      if (result.success) saved.sent_at = new Date();
      saved.provider = 'email';
      if (result.providerRef) saved.provider_ref = result.providerRef;
      if (result.error) saved.error_message = result.error;
    } catch (err: any) {
      saved.status = NotificationStatus.FAILED;
      saved.error_message = err.message;
      this.logger.error(`Email send failed: ${err.message}`);
    }

    await this.notificationsRepo.save(saved);
    return saved;
  }

  private async sendWhatsapp(
    propertyId: string,
    bookingId: string,
    template: NotificationTemplate,
    recipientType: RecipientType,
    to: string,
    templateName: string,
    templateParams: Record<string, string>,
  ) {
    const notification = this.notificationsRepo.create({
      property_id: propertyId,
      booking_id: bookingId,
      channel: NotificationChannel.WHATSAPP,
      template,
      recipient_type: recipientType,
      recipient_phone: to,
      subject: templateName,
      body: JSON.stringify(templateParams),
      status: NotificationStatus.PENDING,
    });
    const saved = await this.notificationsRepo.save(notification);

    try {
      const result = await this.whatsappProvider.send({ to, templateName, templateParams });
      saved.status = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
      if (result.success) saved.sent_at = new Date();
      saved.provider = 'whatsapp';
      if (result.providerRef) saved.provider_ref = result.providerRef;
      if (result.error) saved.error_message = result.error;
    } catch (err: any) {
      saved.status = NotificationStatus.FAILED;
      saved.error_message = err.message;
      this.logger.error(`WhatsApp send failed: ${err.message}`);
    }

    await this.notificationsRepo.save(saved);
    return saved;
  }

  // -- Notification settings ----------------------------------------------------

  async getSettings(propertyId: string): Promise<NotificationSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { property_id: propertyId },
    });
    if (!settings) {
      settings = this.settingsRepo.create({ property_id: propertyId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(
    propertyId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettings> {
    let settings = await this.getSettings(propertyId);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  private async loadBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['guest', 'room', 'room.room_type'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private buildTemplateData(booking: Booking, property: Property): BookingTemplateData {
    return {
      guestName: `${booking.guest?.first_name || ''} ${booking.guest?.last_name || ''}`.trim(),
      propertyName: property.name,
      referenceNumber: booking.reference_number,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      roomName: booking.room?.name || 'Room',
      totalPrice: Number(booking.total_price).toFixed(2),
      currency: booking.currency,
      specialRequests: booking.special_requests,
      checkInTime: property.check_in_time,
      checkOutTime: property.check_out_time,
    };
  }
}
