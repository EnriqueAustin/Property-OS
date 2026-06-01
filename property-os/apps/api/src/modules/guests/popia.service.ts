import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GuestConsent,
  ConsentStatus,
  ConsentType,
} from './entities/guest-consent.entity';
import { DataRetentionSettings } from './entities/data-retention-settings.entity';
import { Guest } from '../bookings/entities/guest.entity';
import { Booking } from '../bookings/entities/booking.entity';

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
  ) {}

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
    return { message: 'Your personal data has been anonymised in compliance with POPIA.' };
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
      relations: ['guest'],
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
