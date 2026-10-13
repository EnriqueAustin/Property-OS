import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createHash, randomBytes } from 'crypto';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  GuestConsent,
  ConsentStatus,
  ConsentType,
} from './entities/guest-consent.entity';
import { DataRetentionSettings } from './entities/data-retention-settings.entity';
import {
  ErasureRequest,
  ErasureRequestStatus,
} from './entities/erasure-request.entity';
import { Guest } from '../bookings/entities/guest.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { EmailProvider } from '../notifications/providers/email.provider';
import { erasureConfirmationEmail } from '../notifications/templates/email.templates';
import { safeUrl } from '../notifications/templates/html-escape.util';

@Injectable()
export class PopiaService {
  private readonly logger = new Logger(PopiaService.name);

  constructor(
    @InjectRepository(GuestConsent)
    private consentRepo: Repository<GuestConsent>,
    @InjectRepository(DataRetentionSettings)
    private retentionRepo: Repository<DataRetentionSettings>,
    @InjectRepository(Guest)
    private guestsRepo: Repository<Guest>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(ErasureRequest)
    private erasureRepo: Repository<ErasureRequest>,
    private readonly emailProvider: EmailProvider,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private get graceDays(): number {
    return parseInt(
      this.config.get<string>('POPIA_ERASURE_GRACE_DAYS') ?? '7',
      10,
    );
  }

  async grantConsent(
    referenceNumber: string,
    email: string,
    consentTypes: ConsentType[],
    ip?: string,
    userAgent?: string,
    idNumber?: string,
  ) {
    const { guest, booking } = await this.resolveGuestFromBooking(referenceNumber, email);

    if (idNumber) {
      guest.id_number = idNumber;
      await this.guestsRepo.save(guest);
    }

    const results: GuestConsent[] = [];
    for (const type of consentTypes) {
      const existing = await this.consentRepo.findOne({
        where: {
          guest_id: guest.id,
          property_id: booking.property_id,
          consent_type: type,
          status: ConsentStatus.GRANTED,
        },
      });
      if (existing) {
        results.push(existing);
        continue;
      }

      const consent = this.consentRepo.create({
        guest_id: guest.id,
        property_id: booking.property_id,
        consent_type: type,
        status: ConsentStatus.GRANTED,
        purpose: this.getPurposeText(type),
        ip_address: ip ?? (null as any),
        user_agent: userAgent ?? (null as any),
      });
      results.push(await this.consentRepo.save(consent));
    }

    return {
      guestId: guest.id,
      consents: results.map((c) => ({
        type: c.consent_type,
        status: c.status,
        grantedAt: c.granted_at,
      })),
    };
  }

  async withdrawConsent(
    referenceNumber: string,
    email: string,
    consentTypes: ConsentType[],
  ) {
    const { guest, booking } = await this.resolveGuestFromBooking(referenceNumber, email);

    for (const type of consentTypes) {
      if (type === ConsentType.DATA_PROCESSING) {
        throw new BadRequestException(
          'Cannot withdraw data processing consent while an active booking exists. Please contact the property to discuss your options.',
        );
      }

      await this.consentRepo.update(
        {
          guest_id: guest.id,
          property_id: booking.property_id,
          consent_type: type,
          status: ConsentStatus.GRANTED,
        },
        {
          status: ConsentStatus.WITHDRAWN,
          withdrawn_at: new Date(),
        },
      );
    }

    return { message: 'Consent withdrawn successfully' };
  }

  /**
   * Step 1 of erasure (audit S5): validate ownership, then email a confirmation
   * link containing a random token (stored only as a hash, 24h expiry). Nothing
   * is anonymised here — merely holding the original request email is no longer
   * enough to erase a guest.
   */
  async requestErasure(referenceNumber: string, email: string) {
    const { guest, booking } = await this.resolveGuestFromBooking(referenceNumber, email);

    const activeBookings = await this.bookingsRepo.count({
      where: { guest_id: guest.id, status: 'confirmed' as any },
    });
    if (activeBookings > 0) {
      throw new BadRequestException(
        'Cannot process erasure request while active bookings exist. Please cancel all bookings first.',
      );
    }

    // Supersede any earlier still-pending request for this guest.
    await this.erasureRepo.update(
      { guest_id: guest.id, status: ErasureRequestStatus.PENDING },
      { status: ErasureRequestStatus.CANCELLED, cancelled_at: new Date() },
    );

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const request = this.erasureRepo.create({
      guest_id: guest.id,
      property_id: booking.property_id,
      token_hash: this.hashToken(rawToken),
      status: ErasureRequestStatus.PENDING,
      expires_at: expiresAt,
    });
    await this.erasureRepo.save(request);

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const confirmUrl = safeUrl(
      `${frontendUrl.replace(/\/+$/, '')}/popia/erasure/confirm?token=${rawToken}`,
    );

    if (guest.email) {
      const { subject, html } = erasureConfirmationEmail({
        guestName: `${guest.first_name || ''} ${guest.last_name || ''}`.trim() || 'Guest',
        propertyName: booking.property?.name || 'the property',
        referenceNumber,
        confirmUrl,
        graceDays: this.graceDays,
      });
      await this.emailProvider.send({ to: guest.email, subject, html });
    }

    this.logger.log(`Erasure confirmation requested for guest ${guest.id}`);
    return {
      message:
        'We have emailed you a confirmation link. Your data will only be erased after you confirm, followed by a grace period during which you can still cancel.',
    };
  }

  /**
   * Step 2: the guest clicks the emailed link. Validates the token (hash match,
   * not expired, still pending) and schedules anonymisation after the grace
   * period rather than performing it immediately.
   */
  async confirmErasure(token: string) {
    const request = await this.erasureRepo.findOne({
      where: {
        token_hash: this.hashToken(token),
        status: ErasureRequestStatus.PENDING,
      },
    });
    if (!request) {
      throw new NotFoundException('Invalid or already-used confirmation link');
    }
    if (request.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('This confirmation link has expired. Please submit a new erasure request.');
    }

    const now = new Date();
    request.status = ErasureRequestStatus.CONFIRMED;
    request.confirmed_at = now;
    request.scheduled_at = new Date(now.getTime() + this.graceDays * 24 * 60 * 60 * 1000);
    await this.erasureRepo.save(request);

    this.logger.log(
      `Erasure confirmed for guest ${request.guest_id}; scheduled for ${request.scheduled_at.toISOString()}`,
    );
    return {
      message: `Your erasure request is confirmed. Your data will be anonymised on ${request.scheduled_at
        .toISOString()
        .slice(0, 10)}. You may cancel any time before then.`,
      scheduledAt: request.scheduled_at,
    };
  }

  /**
   * Step 2b: cancel a confirmed-but-not-yet-executed request. Verifies the
   * requester owns the booking before cancelling.
   */
  async cancelErasure(referenceNumber: string, email: string) {
    const { guest } = await this.resolveGuestFromBooking(referenceNumber, email);

    const result = await this.erasureRepo.update(
      {
        guest_id: guest.id,
        status: ErasureRequestStatus.CONFIRMED,
      },
      { status: ErasureRequestStatus.CANCELLED, cancelled_at: new Date() },
    );

    if (!result.affected) {
      throw new NotFoundException('No pending erasure request found to cancel');
    }

    this.logger.log(`Erasure cancelled for guest ${guest.id}`);
    return { message: 'Your erasure request has been cancelled. Your data will be retained.' };
  }

  /**
   * Step 3: scheduled sweep that anonymises guests whose grace period has
   * elapsed. Runs hourly via the app's ScheduleModule.
   *
   * NOTE: like the other @Cron jobs in this codebase, this is not yet
   * multi-instance-safe (audit P1 — scheduled jobs). With >1 API instance it
   * could run on each; the per-row status guard keeps it idempotent, but a
   * distributed lock / queue should be added platform-wide.
   */
  @Cron('0 15 * * * *')
  async processScheduledErasures() {
    const due = await this.erasureRepo.find({
      where: {
        status: ErasureRequestStatus.CONFIRMED,
        scheduled_at: LessThanOrEqual(new Date()),
      },
    });

    for (const request of due) {
      try {
        await this.performErasure(request.guest_id);
        request.status = ErasureRequestStatus.COMPLETED;
        request.completed_at = new Date();
        await this.erasureRepo.save(request);
      } catch (err: any) {
        this.logger.error(
          `Failed to anonymise guest ${request.guest_id}: ${err?.message ?? err}`,
        );
      }
    }
    if (due.length) {
      this.logger.log(`Processed ${due.length} scheduled erasure request(s)`);
    }
    return { processed: due.length };
  }

  /**
   * Irreversibly anonymise a guest's personal data. Internal — only reached via
   * a confirmed request whose grace period has elapsed.
   */
  private async performErasure(guestId: string) {
    const guest = await this.guestsRepo.findOne({ where: { id: guestId } });
    if (!guest) return;

    guest.first_name = 'Anonymised';
    guest.last_name = 'Guest';
    guest.email = `erased-${guest.id.slice(0, 8)}@anonymised.local`;
    guest.phone = null as any;
    guest.id_number = null as any;
    guest.notes = null as any;
    guest.country = null as any;
    await this.guestsRepo.save(guest);

    await this.consentRepo.update(
      { guest_id: guest.id },
      { status: ConsentStatus.WITHDRAWN, withdrawn_at: new Date() },
    );

    this.logger.log(`Erasure completed for guest ${guest.id}`);
  }

  async getGuestConsents(guestId: string) {
    return this.consentRepo.find({
      where: { guest_id: guestId },
      order: { granted_at: 'DESC' },
    });
  }

  async getPropertyConsents(propertyId: string, page = 1, limit = 20) {
    const [data, total] = await this.consentRepo.findAndCount({
      where: { property_id: propertyId },
      relations: ['guest'],
      order: { granted_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRetentionSettings(propertyId: string) {
    let settings = await this.retentionRepo.findOne({
      where: { property_id: propertyId },
    });
    if (!settings) {
      settings = this.retentionRepo.create({ property_id: propertyId });
      settings = await this.retentionRepo.save(settings);
    }
    return settings;
  }

  async updateRetentionSettings(propertyId: string, dto: any) {
    let settings = await this.getRetentionSettings(propertyId);
    if (dto.guestDataRetentionDays !== undefined)
      settings.guest_data_retention_days = dto.guestDataRetentionDays;
    if (dto.bookingDataRetentionDays !== undefined)
      settings.booking_data_retention_days = dto.bookingDataRetentionDays;
    if (dto.paymentDataRetentionDays !== undefined)
      settings.payment_data_retention_days = dto.paymentDataRetentionDays;
    if (dto.autoAnonymizeExpired !== undefined)
      settings.auto_anonymize_expired = dto.autoAnonymizeExpired;
    if (dto.privacyPolicyUrl !== undefined)
      settings.privacy_policy_url = dto.privacyPolicyUrl;
    if (dto.dataOfficerEmail !== undefined)
      settings.data_officer_email = dto.dataOfficerEmail;
    return this.retentionRepo.save(settings);
  }

  async exportGuestData(referenceNumber: string, email: string) {
    const { guest } = await this.resolveGuestFromBooking(referenceNumber, email);

    const bookings = await this.bookingsRepo.find({
      where: { guest_id: guest.id },
      select: [
        'reference_number', 'check_in', 'check_out', 'nights',
        'status', 'source', 'guest_count', 'total_price', 'currency',
        'created_at',
      ],
    });

    const consents = await this.consentRepo.find({
      where: { guest_id: guest.id },
    });

    return {
      personalData: {
        firstName: guest.first_name,
        lastName: guest.last_name,
        email: guest.email,
        phone: guest.phone,
        country: guest.country,
        idNumber: guest.id_number ? '***' + guest.id_number.slice(-4) : null,
        createdAt: guest.created_at,
      },
      bookings: bookings.map((b) => ({
        reference: b.reference_number,
        checkIn: b.check_in,
        checkOut: b.check_out,
        status: b.status,
        total: Number(b.total_price),
        currency: b.currency,
      })),
      consents: consents.map((c) => ({
        type: c.consent_type,
        status: c.status,
        grantedAt: c.granted_at,
        withdrawnAt: c.withdrawn_at,
      })),
      exportedAt: new Date().toISOString(),
    };
  }

  private async resolveGuestFromBooking(referenceNumber: string, email: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: referenceNumber },
      relations: ['guest', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }
    return { guest: booking.guest, booking };
  }

  private getPurposeText(type: ConsentType): string {
    switch (type) {
      case ConsentType.DATA_PROCESSING:
        return 'Processing of personal data for booking management and guest services as required under POPIA.';
      case ConsentType.MARKETING_EMAIL:
        return 'Receiving marketing communications via email about promotions and offers.';
      case ConsentType.MARKETING_WHATSAPP:
        return 'Receiving marketing communications via WhatsApp about promotions and offers.';
      case ConsentType.THIRD_PARTY_SHARING:
        return 'Sharing of personal data with third-party service providers for booking fulfillment.';
    }
  }
}
