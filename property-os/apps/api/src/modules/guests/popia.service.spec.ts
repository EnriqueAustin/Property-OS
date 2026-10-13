import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PopiaService } from './popia.service';
import { ConfigService } from '@nestjs/config';
import { GuestConsent, ConsentStatus, ConsentType } from './entities/guest-consent.entity';
import { DataRetentionSettings } from './entities/data-retention-settings.entity';
import { ErasureRequest, ErasureRequestStatus } from './entities/erasure-request.entity';
import { Guest } from '../bookings/entities/guest.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { EmailProvider } from '../notifications/providers/email.provider';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'consent-1', ...data })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  count: jest.fn().mockResolvedValue(0),
});

const mockGuest = {
  id: 'guest-1',
  property_id: 'prop-1',
  first_name: 'Sarah',
  last_name: 'Jones',
  email: 'sarah@example.com',
  phone: '+27821111111',
  country: 'ZA',
  id_number: null,
  notes: 'VIP',
  total_stays: 2,
  total_revenue: 5000,
  created_at: new Date(),
};

const mockBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  reference_number: 'POS-2026-0001',
  status: 'confirmed',
  guest_id: 'guest-1',
  guest: mockGuest,
};

describe('PopiaService', () => {
  let service: PopiaService;
  let consentRepo: ReturnType<typeof mockRepo>;
  let retentionRepo: ReturnType<typeof mockRepo>;
  let guestsRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;
  let erasureRepo: ReturnType<typeof mockRepo>;
  let emailProvider: { send: jest.Mock };

  beforeEach(async () => {
    consentRepo = mockRepo();
    retentionRepo = mockRepo();
    guestsRepo = mockRepo();
    bookingsRepo = mockRepo();
    erasureRepo = mockRepo();
    emailProvider = { send: jest.fn().mockResolvedValue({ success: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PopiaService,
        { provide: getRepositoryToken(GuestConsent), useValue: consentRepo },
        { provide: getRepositoryToken(DataRetentionSettings), useValue: retentionRepo },
        { provide: getRepositoryToken(Guest), useValue: guestsRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(ErasureRequest), useValue: erasureRepo },
        { provide: EmailProvider, useValue: emailProvider },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();

    service = module.get<PopiaService>(PopiaService);
    jest.clearAllMocks();
  });

  describe('grantConsent', () => {
    it('should create consent records for the guest', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      consentRepo.findOne.mockResolvedValue(null);

      const result = await service.grantConsent(
        'POS-2026-0001',
        'sarah@example.com',
        [ConsentType.DATA_PROCESSING, ConsentType.MARKETING_EMAIL],
      );

      expect(result.guestId).toBe('guest-1');
      expect(result.consents).toHaveLength(2);
      expect(consentRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should skip creating duplicate consents', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      consentRepo.findOne.mockResolvedValue({
        id: 'existing',
        consent_type: ConsentType.DATA_PROCESSING,
        status: ConsentStatus.GRANTED,
      });

      const result = await service.grantConsent(
        'POS-2026-0001',
        'sarah@example.com',
        [ConsentType.DATA_PROCESSING],
      );

      expect(result.consents).toHaveLength(1);
      expect(consentRepo.save).not.toHaveBeenCalled();
    });

    it('should update guest ID number when provided', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      consentRepo.findOne.mockResolvedValue(null);

      await service.grantConsent(
        'POS-2026-0001',
        'sarah@example.com',
        [ConsentType.DATA_PROCESSING],
        '127.0.0.1',
        'Chrome',
        '9001015555088',
      );

      expect(guestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id_number: '9001015555088' }),
      );
    });

    it('should throw when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.grantConsent('NOPE', 'sarah@example.com', [ConsentType.DATA_PROCESSING]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when email does not match', async () => {
      bookingsRepo.findOne.mockResolvedValue({
        ...mockBooking,
        guest: { ...mockGuest, email: 'other@test.com' },
      });

      await expect(
        service.grantConsent('POS-2026-0001', 'sarah@example.com', [ConsentType.DATA_PROCESSING]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('withdrawConsent', () => {
    it('should withdraw marketing consent', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);

      const result = await service.withdrawConsent(
        'POS-2026-0001',
        'sarah@example.com',
        [ConsentType.MARKETING_EMAIL],
      );

      expect(result.message).toContain('withdrawn');
      expect(consentRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ consent_type: ConsentType.MARKETING_EMAIL }),
        expect.objectContaining({ status: ConsentStatus.WITHDRAWN }),
      );
    });

    it('should throw when trying to withdraw DATA_PROCESSING consent', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);

      await expect(
        service.withdrawConsent(
          'POS-2026-0001',
          'sarah@example.com',
          [ConsentType.DATA_PROCESSING],
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestErasure', () => {
    it('should create a pending request and email a confirmation link, not anonymise immediately', async () => {
      bookingsRepo.findOne.mockResolvedValue({
        ...mockBooking,
        property: { name: 'Test Lodge' },
        guest: { ...mockGuest, email: 'sarah@example.com' },
      });
      bookingsRepo.count.mockResolvedValue(0);

      const result = await service.requestErasure('POS-2026-0001', 'sarah@example.com');

      expect(result.message).toContain('confirmation');
      // A pending erasure request is persisted with a hashed token and expiry.
      expect(erasureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_id: 'guest-1',
          status: ErasureRequestStatus.PENDING,
        }),
      );
      expect(erasureRepo.save).toHaveBeenCalled();
      // A confirmation email is sent.
      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'sarah@example.com' }),
      );
      // The guest is NOT anonymised at request time.
      expect(guestsRepo.save).not.toHaveBeenCalled();
    });

    it('should throw when active bookings exist', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, guest: { ...mockGuest, email: 'sarah@example.com' } });
      bookingsRepo.count.mockResolvedValue(1);

      await expect(
        service.requestErasure('POS-2026-0001', 'sarah@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmErasure', () => {
    it('should schedule anonymisation after the grace period, not anonymise immediately', async () => {
      erasureRepo.findOne.mockResolvedValue({
        id: 'er-1',
        guest_id: 'guest-1',
        status: ErasureRequestStatus.PENDING,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      });
      erasureRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.confirmErasure('a-valid-token');

      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(erasureRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ErasureRequestStatus.CONFIRMED }),
      );
      expect(guestsRepo.save).not.toHaveBeenCalled();
    });

    it('should throw for an invalid/used token', async () => {
      erasureRepo.findOne.mockResolvedValue(null);
      await expect(service.confirmErasure('bad')).rejects.toThrow(NotFoundException);
    });

    it('should throw for an expired confirmation link', async () => {
      erasureRepo.findOne.mockResolvedValue({
        id: 'er-1',
        guest_id: 'guest-1',
        status: ErasureRequestStatus.PENDING,
        expires_at: new Date(Date.now() - 1000),
      });
      await expect(service.confirmErasure('expired')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processScheduledErasures', () => {
    it('should anonymise guests whose grace period has elapsed', async () => {
      erasureRepo.find.mockResolvedValue([
        { id: 'er-1', guest_id: 'guest-1', status: ErasureRequestStatus.CONFIRMED },
      ]);
      guestsRepo.findOne.mockResolvedValue({ ...mockGuest });
      guestsRepo.save.mockImplementation((data) => Promise.resolve(data));
      erasureRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.processScheduledErasures();

      expect(result.processed).toBe(1);
      expect(guestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Anonymised',
          last_name: 'Guest',
          phone: null,
          id_number: null,
        }),
      );
      expect(consentRepo.update).toHaveBeenCalledWith(
        { guest_id: 'guest-1' },
        expect.objectContaining({ status: ConsentStatus.WITHDRAWN }),
      );
      expect(erasureRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ErasureRequestStatus.COMPLETED }),
      );
    });
  });

  describe('exportGuestData', () => {
    it('should return all guest data in structured format', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, guest: { ...mockGuest, email: 'sarah@example.com' } });
      bookingsRepo.find.mockResolvedValue([
        {
          reference_number: 'POS-001',
          check_in: '2026-06-01',
          check_out: '2026-06-03',
          status: 'checked_out',
          total_price: 2000,
          currency: 'ZAR',
        },
      ]);
      consentRepo.find.mockResolvedValue([
        {
          consent_type: ConsentType.DATA_PROCESSING,
          status: ConsentStatus.GRANTED,
          granted_at: new Date(),
          withdrawn_at: null,
        },
      ]);

      const result = await service.exportGuestData('POS-2026-0001', 'sarah@example.com');

      expect(result.personalData.firstName).toBe('Sarah');
      expect(result.bookings).toHaveLength(1);
      expect(result.consents).toHaveLength(1);
      expect(result.exportedAt).toBeDefined();
    });
  });

  describe('getRetentionSettings', () => {
    it('should return existing settings', async () => {
      retentionRepo.findOne.mockResolvedValue({ property_id: 'prop-1', guest_data_retention_days: 365 });

      const result = await service.getRetentionSettings('prop-1');

      expect(result.guest_data_retention_days).toBe(365);
    });

    it('should create default settings when none exist', async () => {
      retentionRepo.findOne.mockResolvedValue(null);
      retentionRepo.save.mockResolvedValue({ property_id: 'prop-1' });

      await service.getRetentionSettings('prop-1');

      expect(retentionRepo.create).toHaveBeenCalled();
      expect(retentionRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateRetentionSettings', () => {
    it('should update retention settings', async () => {
      retentionRepo.findOne.mockResolvedValue({ property_id: 'prop-1' });
      retentionRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.updateRetentionSettings('prop-1', {
        guestDataRetentionDays: 180,
        autoAnonymizeExpired: true,
      });

      expect(retentionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_data_retention_days: 180,
          auto_anonymize_expired: true,
        }),
      );
    });
  });
});
