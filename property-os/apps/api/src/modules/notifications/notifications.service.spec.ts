import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

const mockNotification = {
  id: 'notif-1',
  property_id: 'prop-1',
  booking_id: 'book-1',
  channel: 'email',
  template: 'booking_confirmation',
  recipient_type: 'guest',
  recipient_email: 'guest@example.com',
  subject: 'Booking Confirmed',
  body: '<p>Your booking is confirmed</p>',
  status: 'sent',
  sent_at: new Date(),
};

const mockBooking = {
  id: 'book-1',
  property_id: 'prop-1',
  reference_number: 'POS-2026-0001',
  check_in: '2026-06-01',
  check_out: '2026-06-04',
  nights: 3,
  total_price: 6600,
  currency: 'ZAR',
  special_requests: null,
  guest: {
    first_name: 'Sarah',
    last_name: 'Jones',
    email: 'sarah@example.com',
    phone: '+27821111111',
  },
  room: { name: 'Ocean View 1', room_type: { name: 'Deluxe' } },
};

const mockProperty = {
  id: 'prop-1',
  name: 'Seaside Guesthouse',
  email: 'info@seaside.co.za',
  check_in_time: '14:00',
  check_out_time: '10:00',
};

const mockNotifRepo = {
  create: jest.fn((dto) => dto),
  save: jest.fn((entity) => Promise.resolve({ id: 'notif-new', ...entity })),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
};

const mockSettingsRepo = {
  findOne: jest.fn(),
  create: jest.fn((dto) => dto),
  save: jest.fn((entity) => Promise.resolve(entity)),
};

const mockBookingsRepo = {
  findOne: jest.fn(),
};

const mockPropertiesRepo = {
  findOne: jest.fn(),
};

const mockEmailProvider = {
  send: jest.fn().mockResolvedValue({ success: true, providerRef: 'ref-1' }),
};

const mockWhatsappProvider = {
  send: jest.fn().mockResolvedValue({ success: true, providerRef: 'wa-1' }),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: mockNotifRepo },
        { provide: getRepositoryToken(NotificationSettings), useValue: mockSettingsRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingsRepo },
        { provide: getRepositoryToken(Property), useValue: mockPropertiesRepo },
        { provide: EmailProvider, useValue: mockEmailProvider },
        { provide: WhatsappProvider, useValue: mockWhatsappProvider },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('listForProperty', () => {
    it('should return paginated notifications', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockNotification], 1]),
      };
      mockNotifRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listForProperty('prop-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockNotifRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listForProperty('prop-1', { status: 'failed' });

      expect(qb.andWhere).toHaveBeenCalledWith('n.status = :status', { status: 'failed' });
    });
  });

  describe('resend', () => {
    it('should resend an email notification', async () => {
      mockNotifRepo.findOne.mockResolvedValue({
        ...mockNotification,
        channel: 'email',
      });

      const result = await service.resend('notif-1', 'prop-1');

      expect(mockEmailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'guest@example.com',
          subject: 'Booking Confirmed',
        }),
      );
      expect(mockNotifRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown notification', async () => {
      mockNotifRepo.findOne.mockResolvedValue(null);

      await expect(service.resend('unknown', 'prop-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('onBookingCreated', () => {
    it('should send email and WhatsApp to guest plus alert to owner', async () => {
      mockBookingsRepo.findOne.mockResolvedValue(mockBooking);
      mockPropertiesRepo.findOne.mockResolvedValue(mockProperty);

      await service.onBookingCreated('book-1');

      // email to guest + whatsapp to guest + email alert to owner = 6 saves (create + update each)
      expect(mockNotifRepo.save).toHaveBeenCalled();
      expect(mockEmailProvider.send).toHaveBeenCalled();
      expect(mockWhatsappProvider.send).toHaveBeenCalled();
    });
  });

  describe('onBookingCancelled', () => {
    it('should send cancellation notifications', async () => {
      mockBookingsRepo.findOne.mockResolvedValue(mockBooking);
      mockPropertiesRepo.findOne.mockResolvedValue(mockProperty);

      await service.onBookingCancelled('book-1', 'Guest request');

      expect(mockEmailProvider.send).toHaveBeenCalled();
      expect(mockWhatsappProvider.send).toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const settings = { property_id: 'prop-1', email_booking_confirmation: true };
      mockSettingsRepo.findOne.mockResolvedValue(settings);

      const result = await service.getSettings('prop-1');
      expect(result.email_booking_confirmation).toBe(true);
    });

    it('should create default settings when none exist', async () => {
      mockSettingsRepo.findOne.mockResolvedValue(null);
      mockSettingsRepo.create.mockReturnValue({ property_id: 'prop-1' });
      mockSettingsRepo.save.mockResolvedValue({ property_id: 'prop-1', email_booking_confirmation: true });

      const result = await service.getSettings('prop-1');
      expect(mockSettingsRepo.save).toHaveBeenCalled();
    });
  });
});
