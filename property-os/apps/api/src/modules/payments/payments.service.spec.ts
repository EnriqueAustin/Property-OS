import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentsService } from './payments.service';
import { Payment, PaymentProvider, PaymentStatus, PaymentType } from './entities/payment.entity';
import { PaymentSettings } from './entities/payment-settings.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import { PAYMENT_EVENTS } from './events/payment.events';
import { verifyPayfastSignature, buildPayfastRedirectUrl } from './utils/payfast.util';

const mockBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  reference_number: 'POS-2026-0001',
  total_price: 2000,
  nights: 2,
  currency: 'ZAR',
  guest: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
};

const mockSettings = {
  property_id: 'prop-1',
  payfast_enabled: true,
  payfast_merchant_id: 'merchant-1',
  payfast_merchant_key: 'key-1',
  payfast_passphrase: 'test-pass',
  payfast_sandbox: true,
  eft_enabled: true,
  eft_bank_name: 'FNB',
  eft_account_holder: 'Test Property',
  eft_account_number: '123456',
  eft_branch_code: '250655',
  eft_account_type: 'cheque',
};

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'pay-1', ...data })),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
});

const mockEventEmitter = { emit: jest.fn() };
const mockConfigService = { get: jest.fn((key: string) => {
  if (key === 'PAYFAST_SANDBOX') return 'true';
  return 'http://localhost:3000';
}) };

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: ReturnType<typeof mockRepo>;
  let settingsRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    paymentsRepo = mockRepo();
    settingsRepo = mockRepo();
    bookingsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(PaymentSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(Property), useValue: mockRepo() },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('initiatePayfast', () => {
    it('should create a pending payment and return redirect URL', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      settingsRepo.findOne.mockResolvedValue(mockSettings);
      paymentsRepo.save.mockImplementation((data) => ({ id: 'pay-1', ...data }));

      const result = await service.initiatePayfast('prop-1', {
        bookingId: 'booking-1',
        paymentType: PaymentType.FULL,
      });

      expect(result.redirectUrl).toContain('sandbox.payfast.co.za');
      expect(result.amount).toBe(2000);
      expect(result.sandbox).toBe(true);
    });

    it('should throw when PayFast is not enabled', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      settingsRepo.findOne.mockResolvedValue({ ...mockSettings, payfast_enabled: false });

      await expect(
        service.initiatePayfast('prop-1', {
          bookingId: 'booking-1',
          paymentType: PaymentType.FULL,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate 50% deposit amount', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      settingsRepo.findOne.mockResolvedValue(mockSettings);
      paymentsRepo.save.mockImplementation((data) => ({ id: 'pay-1', ...data }));

      const result = await service.initiatePayfast('prop-1', {
        bookingId: 'booking-1',
        paymentType: PaymentType.DEPOSIT,
      });

      expect(result.amount).toBe(1000);
    });
  });

  describe('handlePayfastItn', () => {
    it('should mark payment as completed on COMPLETE status', async () => {
      const payment = {
        id: 'pay-1',
        property_id: 'prop-1',
        booking_id: 'booking-1',
        amount: 2000,
        status: PaymentStatus.PENDING,
        provider_data: {},
      };
      paymentsRepo.findOne.mockResolvedValue(payment);
      settingsRepo.findOne.mockResolvedValue(mockSettings);

      const { signature } = buildPayfastRedirectUrl(
        {
          merchant_id: 'merchant-1',
          merchant_key: 'key-1',
          return_url: '',
          cancel_url: '',
          notify_url: '',
          name_first: 'John',
          name_last: 'Doe',
          email_address: 'john@example.com',
          m_payment_id: 'pay-1',
          amount: '2000.00',
          item_name: 'Test',
        },
        'test-pass',
        true,
      );

      const itnBody: Record<string, string> = {
        m_payment_id: 'pay-1',
        payment_status: 'COMPLETE',
        pf_payment_id: 'pf-123',
        merchant_id: 'merchant-1',
        amount_gross: '2000.00',
      };

      const paramString = Object.entries(itnBody)
        .filter(([, v]) => v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      const crypto = require('crypto');
      itnBody.signature = crypto.createHash('md5')
        .update(`${paramString}&passphrase=${encodeURIComponent('test-pass')}`)
        .digest('hex');

      await service.handlePayfastItn(itnBody, '127.0.0.1');

      expect(paymentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PAYMENT_EVENTS.COMPLETED,
        expect.anything(),
      );
    });

    it('should mark payment as failed on invalid signature', async () => {
      const payment = {
        id: 'pay-1',
        property_id: 'prop-1',
        status: PaymentStatus.PENDING,
        provider_data: {},
      };
      paymentsRepo.findOne.mockResolvedValue(payment);
      settingsRepo.findOne.mockResolvedValue(mockSettings);

      await service.handlePayfastItn(
        { m_payment_id: 'pay-1', signature: 'bad-sig', payment_status: 'COMPLETE' },
        '127.0.0.1',
      );

      expect(paymentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.FAILED }),
      );
    });
  });

  describe('confirmEft', () => {
    it('should confirm an EFT payment', async () => {
      const payment = {
        id: 'pay-1',
        property_id: 'prop-1',
        booking_id: 'booking-1',
        amount: 2000,
        status: PaymentStatus.PENDING,
      };
      paymentsRepo.findOne.mockResolvedValue(payment);

      const result = await service.confirmEft('pay-1', 'prop-1', 'user-1', {});

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PAYMENT_EVENTS.COMPLETED,
        expect.anything(),
      );
    });

    it('should reject confirming a non-pending payment', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        property_id: 'prop-1',
        status: PaymentStatus.COMPLETED,
      });

      await expect(
        service.confirmEft('pay-1', 'prop-1', 'user-1', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBookingPaymentSummary', () => {
    it('should calculate correct balance', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      paymentsRepo.find.mockResolvedValue([
        { amount: 1000, status: PaymentStatus.COMPLETED, payment_type: PaymentType.DEPOSIT },
        { amount: 500, status: PaymentStatus.COMPLETED, payment_type: PaymentType.REFUND },
        { amount: 200, status: PaymentStatus.PENDING, payment_type: PaymentType.FULL },
      ]);

      const result = await service.getBookingPaymentSummary('booking-1', 'prop-1');

      expect(result.totalOwed).toBe(2000);
      expect(result.totalPaid).toBe(1000);
      expect(result.totalRefunded).toBe(500);
      expect(result.balance).toBe(1500);
      expect(result.fullyPaid).toBe(false);
    });
  });
});

describe('PayFast Utilities', () => {
  describe('verifyPayfastSignature', () => {
    it('should verify a valid signature', () => {
      const data: Record<string, string> = {
        merchant_id: 'test-merchant',
        amount: '100.00',
      };
      const crypto = require('crypto');
      const paramString = 'amount=100.00&merchant_id=test-merchant';
      const sig = crypto.createHash('md5')
        .update(`${paramString}&passphrase=${encodeURIComponent('secret')}`)
        .digest('hex');
      data.signature = sig;

      expect(verifyPayfastSignature(data, 'secret')).toBe(true);
    });

    it('should reject an invalid signature', () => {
      expect(
        verifyPayfastSignature(
          { merchant_id: 'test', amount: '100', signature: 'wrong' },
          'secret',
        ),
      ).toBe(false);
    });

    it('should reject when signature is missing', () => {
      expect(verifyPayfastSignature({ merchant_id: 'test' }, null)).toBe(false);
    });
  });

  describe('buildPayfastRedirectUrl', () => {
    it('should build sandbox URL when sandbox is true', () => {
      const result = buildPayfastRedirectUrl(
        {
          merchant_id: 'mid',
          merchant_key: 'mkey',
          return_url: 'http://r',
          cancel_url: 'http://c',
          notify_url: 'http://n',
          name_first: 'John',
          name_last: 'Doe',
          email_address: 'j@d.com',
          m_payment_id: 'p1',
          amount: '100.00',
          item_name: 'Test',
        },
        'pass',
        true,
      );

      expect(result.url).toContain('sandbox.payfast.co.za');
      expect(result.signature).toBeTruthy();
    });

    it('should build live URL when sandbox is false', () => {
      const result = buildPayfastRedirectUrl(
        {
          merchant_id: 'mid',
          merchant_key: 'mkey',
          return_url: 'http://r',
          cancel_url: 'http://c',
          notify_url: 'http://n',
          name_first: 'John',
          name_last: 'Doe',
          email_address: 'j@d.com',
          m_payment_id: 'p1',
          amount: '100.00',
          item_name: 'Test',
        },
        null,
        false,
      );

      expect(result.url).toContain('www.payfast.co.za');
    });
  });
});
