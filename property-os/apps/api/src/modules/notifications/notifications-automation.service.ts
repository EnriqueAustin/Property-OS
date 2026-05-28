import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationTemplate,
  RecipientType,
} from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import {
  BookingTemplateData,
  preArrivalEmail,
  PreArrivalData,
  postStayReviewEmail,
} from './templates/email.templates';

@Injectable()
export class NotificationsAutomationService {
  private readonly logger = new Logger(NotificationsAutomationService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    @InjectRepository(NotificationSettings)
    private settingsRepo: Repository<NotificationSettings>,
    private emailProvider: EmailProvider,
    private whatsappProvider: WhatsappProvider,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processAutomatedNotifications() {
    this.logger.log('Processing automated notifications...');
    await this.sendPreArrivalNotifications();
    await this.sendPostStayNotifications();
  }

  private async sendPreArrivalNotifications() {
    const properties = await this.propertiesRepo.find({ where: { is_active: true } });

    for (const property of properties) {
      const settings = await this.settingsRepo.findOne({
        where: { property_id: property.id },
      });
      if (!settings?.email_pre_arrival && !settings?.whatsapp_check_in_info) continue;

      const daysBefore = settings.pre_arrival_days_before || 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0]!;

      const bookings = await this.bookingsRepo.find({
        where: {
          property_id: property.id,
          check_in: targetDateStr,
          status: BookingStatus.CONFIRMED,
        },
        relations: ['guest', 'room', 'room.room_type'],
      });

      for (const booking of bookings) {
        if (!booking.guest) continue;

        const alreadySent = await this.notificationsRepo.findOne({
          where: {
            booking_id: booking.id,
            template: NotificationTemplate.PRE_ARRIVAL,
            status: NotificationStatus.SENT,
          },
        });
        if (alreadySent) continue;

        const templateData = this.buildTemplateData(booking, property);

        if (settings.email_pre_arrival && booking.guest.email) {
          const preArrivalData: PreArrivalData = {
            ...templateData,
            propertyAddress: [property.address_line1, property.address_line2, property.city, property.province]
              .filter(Boolean)
              .join(', ') || undefined,
            propertyPhone: property.phone || undefined,
            wifiName: settings.wifi_name || undefined,
            wifiPassword: settings.wifi_password || undefined,
            directions: settings.directions || undefined,
          };

          const { subject, html } = preArrivalEmail(preArrivalData);
          await this.sendEmail(
            property.id,
            booking.id,
            NotificationTemplate.PRE_ARRIVAL,
            RecipientType.GUEST,
            booking.guest.email,
            subject,
            html,
          );
        }

        if (settings.whatsapp_check_in_info && booking.guest.phone) {
          await this.sendWhatsapp(
            property.id,
            booking.id,
            NotificationTemplate.CHECK_IN_INSTRUCTIONS,
            RecipientType.GUEST,
            booking.guest.phone,
            'check_in_info',
            {
              guest_name: `${booking.guest.first_name} ${booking.guest.last_name}`,
              property: property.name,
              check_in: booking.check_in,
              check_in_time: property.check_in_time || '14:00',
              address: [property.address_line1, property.city].filter(Boolean).join(', '),
              ...(settings.wifi_name ? { wifi: `${settings.wifi_name}${settings.wifi_password ? ` / ${settings.wifi_password}` : ''}` } : {}),
              ...(settings.directions ? { directions: settings.directions } : {}),
            },
          );
        }
      }
    }
  }

  private async sendPostStayNotifications() {
    const properties = await this.propertiesRepo.find({ where: { is_active: true } });

    for (const property of properties) {
      const settings = await this.settingsRepo.findOne({
        where: { property_id: property.id },
      });
      if (!settings?.email_post_stay_review) continue;

      const daysAfter = settings.post_stay_days_after || 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAfter);
      const targetDateStr = targetDate.toISOString().split('T')[0]!;

      const bookings = await this.bookingsRepo.find({
        where: {
          property_id: property.id,
          check_out: targetDateStr,
          status: BookingStatus.CHECKED_OUT,
        },
        relations: ['guest', 'room', 'room.room_type'],
      });

      for (const booking of bookings) {
        if (!booking.guest?.email) continue;

        const alreadySent = await this.notificationsRepo.findOne({
          where: {
            booking_id: booking.id,
            template: NotificationTemplate.POST_STAY_REVIEW,
            status: NotificationStatus.SENT,
          },
        });
        if (alreadySent) continue;

        const templateData = this.buildTemplateData(booking, property);
        const { subject, html } = postStayReviewEmail(templateData);

        await this.sendEmail(
          property.id,
          booking.id,
          NotificationTemplate.POST_STAY_REVIEW,
          RecipientType.GUEST,
          booking.guest.email,
          subject,
          html,
        );
      }
    }
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
      this.logger.error(`Automated email failed: ${err.message}`);
    }

    await this.notificationsRepo.save(saved);
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
      this.logger.error(`Automated WhatsApp failed: ${err.message}`);
    }

    await this.notificationsRepo.save(saved);
  }
}
