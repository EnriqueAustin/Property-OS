import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsAutomationService } from './notifications-automation.service';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationTemplate,
} from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

const mockBookingsRepo = { find: jest.fn() };
const mockPropertiesRepo = { find: jest.fn() };
const mockNotificationsRepo = {
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'notif-1', ...data })),
};
const mockSettingsRepo = { findOne: jest.fn() };

const mockEmailProvider = {
  send: jest.fn().mockResolvedValue({ success: true, providerRef: 'email-ref-1' }),
};
const mockWhatsappProvider = {
  send: jest.fn().mockResolvedValue({ success: true, providerRef: 'wa-ref-1' }),
};

const mockProperty = {
  id: 'prop-1',
  name: 'Seaside Lodge',
  is_active: true,
  check_in_time: '14:00',
  check_out_time: '10:00',
  address_line1: '10 Beach Rd',
  address_line2: null,
  city: 'Cape Town',
  province: 'WC',
  phone: '+2721123',
};

const mockSettings = (overrides: any = {}) => ({
  property_id: 'prop-1',
  email_pre_arrival: true,
  whatsapp_check_in_info: false,
  email_post_stay_review: true,
  pre_arrival_days_before: 1,
  post_stay_days_after: 1,
  wifi_name: 'Lodge-WiFi',
  wifi_password: 'secret123',
  directions: 'Turn left at the beach',
  ...overrides,
});

const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0]!;
};

const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]!;
};

const mockConfirmedBooking = (overrides: any = {}) => ({
  id: 'booking-1',
  property_id: 'prop-1',
  reference_number: 'POS-001',
  check_in: tomorrowStr(),
  check_out: '2026-06-05',
  nights: 3,
  total_price: 3000,
  currency: 'ZAR',
  status: BookingStatus.CONFIRMED,
  special_requests: null,
  guest: {
    first_name: 'Sarah',
    last_name: 'Jones',
    email: 'sarah@example.com',
    phone: '+27821111111',
  },
  room: { name: 'Room 1', room_type: { name: 'Deluxe' } },
  ...overrides,
});

describe('NotificationsAutomationService', () => {
  let service: NotificationsAutomationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsAutomationService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingsRepo },
        { provide: getRepositoryToken(Property), useValue: mockPropertiesRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationsRepo },
        { provide: getRepositoryToken(NotificationSettings), useValue: mockSettingsRepo },
        { provide: EmailProvider, useValue: mockEmailProvider },
        { provide: WhatsappProvider, useValue: mockWhatsappProvider },
      ],
    }).compile();

    service = module.get<NotificationsAutomationService>(NotificationsAutomationService);
    jest.clearAllMocks();
  });

  describe('processAutomatedNotifications', () => {
    it('should send pre-arrival email for tomorrow arrivals', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(mockSettings());
      mockBookingsRepo.find
        .mockResolvedValueOnce([mockConfirmedBooking()]) // pre-arrival
        .mockResolvedValueOnce([]); // post-stay
      mockNotificationsRepo.findOne.mockResolvedValue(null); // not already sent

      await service.processAutomatedNotifications();

      expect(mockEmailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sarah@example.com',
          subject: expect.any(String),
          html: expect.any(String),
        }),
      );
      expect(mockNotificationsRepo.save).toHaveBeenCalled();
    });

    it('should NOT send pre-arrival email when already sent', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(mockSettings());
      mockBookingsRepo.find
        .mockResolvedValueOnce([mockConfirmedBooking()])
        .mockResolvedValueOnce([]);
      mockNotificationsRepo.findOne.mockResolvedValue({ id: 'existing' }); // already sent

      await service.processAutomatedNotifications();

      expect(mockEmailProvider.send).not.toHaveBeenCalled();
    });

    it('should skip property when settings disable pre-arrival', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(
        mockSettings({ email_pre_arrival: false, whatsapp_check_in_info: false, email_post_stay_review: false }),
      );

      await service.processAutomatedNotifications();

      expect(mockEmailProvider.send).not.toHaveBeenCalled();
    });

    it('should skip property when no settings exist', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(null); // applies to both methods

      await service.processAutomatedNotifications();

      expect(mockEmailProvider.send).not.toHaveBeenCalled();
      expect(mockWhatsappProvider.send).not.toHaveBeenCalled();
    });

    it('should send post-stay review email for yesterday checkouts', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(
        mockSettings({ email_pre_arrival: false, whatsapp_check_in_info: false }),
      );
      const checkedOut = mockConfirmedBooking({
        check_out: yesterdayStr(),
        status: BookingStatus.CHECKED_OUT,
      });
      // sendPostStayNotifications queries bookings
      mockBookingsRepo.find.mockResolvedValue([checkedOut]);
      mockNotificationsRepo.findOne.mockResolvedValue(null);

      await service.processAutomatedNotifications();

      expect(mockEmailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'sarah@example.com' }),
      );
    });

    it('should handle email send failure gracefully', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(mockSettings());
      mockBookingsRepo.find
        .mockResolvedValueOnce([mockConfirmedBooking()])
        .mockResolvedValueOnce([]);
      mockNotificationsRepo.findOne.mockResolvedValue(null);
      mockEmailProvider.send.mockRejectedValue(new Error('SMTP down'));

      await service.processAutomatedNotifications();

      expect(mockNotificationsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: NotificationStatus.FAILED,
          error_message: 'SMTP down',
        }),
      );
    });

    it('should send WhatsApp when enabled and guest has phone', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(
        mockSettings({ whatsapp_check_in_info: true }),
      );
      mockBookingsRepo.find
        .mockResolvedValueOnce([mockConfirmedBooking()])
        .mockResolvedValueOnce([]);
      mockNotificationsRepo.findOne.mockResolvedValue(null);

      await service.processAutomatedNotifications();

      expect(mockWhatsappProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+27821111111',
          templateName: 'check_in_info',
        }),
      );
    });

    it('should skip guests without email for pre-arrival', async () => {
      mockPropertiesRepo.find.mockResolvedValue([mockProperty]);
      mockSettingsRepo.findOne.mockResolvedValue(mockSettings({ whatsapp_check_in_info: false }));
      mockBookingsRepo.find
        .mockResolvedValueOnce([mockConfirmedBooking({ guest: { first_name: 'No', last_name: 'Email', email: null, phone: null } })])
        .mockResolvedValueOnce([]);
      mockNotificationsRepo.findOne.mockResolvedValue(null);

      await service.processAutomatedNotifications();

      expect(mockEmailProvider.send).not.toHaveBeenCalled();
    });
  });
});
