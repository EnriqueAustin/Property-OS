import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RefundsService } from './refunds.service';
import { Refund, RefundStatus } from './entities/refund.entity';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PAYMENT_EVENTS } from './events/payment.events';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'refund-1', ...data })),
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

const mockBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  currency: 'ZAR',
};

const mockPayment = {
  id: 'pay-1',
  property_id: 'prop-1',
  booking_id: 'booking-1',
  amount: 2000,
  status: PaymentStatus.COMPLETED,
};

const mockRefund = (overrides: Partial<Refund> = {}) => ({
  id: 'refund-1',
  booking_id: 'booking-1',
  property_id: 'prop-1',
  original_payment_id: 'pay-1',
  amount: 500,
  currency: 'ZAR',
  status: RefundStatus.REQUESTED,
  reason: 'Guest request',
  reason_details: null,
  requested_by: 'user-1',
  approved_by: null,
  approved_at: null,
  processed_by: null,
  processed_at: null,
  completed_at: null,
  notes: null,
  ...overrides,
});

describe('RefundsService', () => {
  let service: RefundsService;
  let refundsRepo: ReturnType<typeof mockRepo>;
  let paymentsRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    refundsRepo = mockRepo();
    paymentsRepo = mockRepo();
    bookingsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: getRepositoryToken(Refund), useValue: refundsRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
    jest.clearAllMocks();
  });

  describe('createRefund', () => {
    it('should create a refund for a completed payment', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      paymentsRepo.findOne.mockResolvedValue(mockPayment);
      refundsRepo.find.mockResolvedValue([]);

      const result = await service.createRefund('prop-1', 'user-1', {
        bookingId: 'booking-1',
        originalPaymentId: 'pay-1',
        amount: 500,
        reason: 'Guest request',
      });

      expect(result.amount).toBe(500);
      expect(result.status).toBe(RefundStatus.REQUESTED);
      expect(result.requested_by).toBe('user-1');
    });

    it('should throw when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createRefund('prop-1', 'user-1', {
          bookingId: 'nope',
          originalPaymentId: 'pay-1',
          amount: 500,
          reason: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when payment not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      paymentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createRefund('prop-1', 'user-1', {
          bookingId: 'booking-1',
          originalPaymentId: 'nope',
          amount: 500,
          reason: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when payment is not completed', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment, status: PaymentStatus.PENDING });

      await expect(
        service.createRefund('prop-1', 'user-1', {
          bookingId: 'booking-1',
          originalPaymentId: 'pay-1',
          amount: 500,
          reason: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when refund amount exceeds available balance', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      paymentsRepo.findOne.mockResolvedValue(mockPayment);
      refundsRepo.find.mockResolvedValue([
        mockRefund({ amount: 1800, status: RefundStatus.APPROVED }),
      ]);

      await expect(
        service.createRefund('prop-1', 'user-1', {
          bookingId: 'booking-1',
          originalPaymentId: 'pay-1',
          amount: 500,
          reason: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should exclude rejected refunds from balance calculation', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      paymentsRepo.findOne.mockResolvedValue(mockPayment);
      refundsRepo.find.mockResolvedValue([
        mockRefund({ amount: 1800, status: RefundStatus.REJECTED }),
      ]);

      const result = await service.createRefund('prop-1', 'user-1', {
        bookingId: 'booking-1',
        originalPaymentId: 'pay-1',
        amount: 500,
        reason: 'test',
      });

      expect(result.amount).toBe(500);
    });
  });

  describe('approveRefund', () => {
    it('should approve a requested refund', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund());
      refundsRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));

      const result = await service.approveRefund('refund-1', 'prop-1', 'admin-1', {});

      expect(result.status).toBe(RefundStatus.APPROVED);
      expect(result.approved_by).toBe('admin-1');
      expect(result.approved_at).toBeInstanceOf(Date);
    });

    it('should throw when refund is not in requested state', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund({ status: RefundStatus.APPROVED }));

      await expect(
        service.approveRefund('refund-1', 'prop-1', 'admin-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when refund not found', async () => {
      refundsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approveRefund('nope', 'prop-1', 'admin-1', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectRefund', () => {
    it('should reject a requested refund', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund());
      refundsRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));

      const result = await service.rejectRefund('refund-1', 'prop-1', 'admin-1', {
        reason: 'Policy does not allow',
      });

      expect(result.status).toBe(RefundStatus.REJECTED);
      expect(result.notes).toContain('Rejected: Policy does not allow');
    });

    it('should throw when refund is not in requested state', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund({ status: RefundStatus.COMPLETED }));

      await expect(
        service.rejectRefund('refund-1', 'prop-1', 'admin-1', { reason: 'no' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processRefund', () => {
    it('should process an approved refund', async () => {
      const approved = mockRefund({ status: RefundStatus.APPROVED });
      refundsRepo.findOne
        .mockResolvedValueOnce(approved) // processRefund lookup
        .mockResolvedValueOnce({ ...approved, status: RefundStatus.PROCESSING }); // completeRefund lookup
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment, provider: 'eft' });
      refundsRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));
      paymentsRepo.create.mockImplementation((data) => data);
      paymentsRepo.save.mockImplementation((data) => Promise.resolve({ id: 'pay-refund', ...data }));

      const result = await service.processRefund('refund-1', 'prop-1', 'admin-1');

      expect(result.status).toBe(RefundStatus.COMPLETED);
    });

    it('should throw when refund is not approved', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund({ status: RefundStatus.REQUESTED }));

      await expect(
        service.processRefund('refund-1', 'prop-1', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeRefund', () => {
    it('should create a refund payment record and emit event', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund({ status: RefundStatus.PROCESSING }));
      refundsRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));
      paymentsRepo.create.mockImplementation((data) => data);
      paymentsRepo.save.mockImplementation((data) => Promise.resolve({ id: 'pay-refund', ...data }));

      const result = await service.completeRefund('refund-1', 'prop-1');

      expect(result.status).toBe(RefundStatus.COMPLETED);
      expect(result.completed_at).toBeInstanceOf(Date);
      expect(paymentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_type: PaymentType.REFUND,
          status: PaymentStatus.COMPLETED,
          amount: 500,
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PAYMENT_EVENTS.REFUNDED,
        expect.anything(),
      );
    });

    it('should throw when refund is not in a processable state', async () => {
      refundsRepo.findOne.mockResolvedValue(mockRefund({ status: RefundStatus.REQUESTED }));

      await expect(
        service.completeRefund('refund-1', 'prop-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listRefunds', () => {
    it('should return paginated refunds', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockRefund()], 1]),
      };
      refundsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listRefunds('prop-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      refundsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listRefunds('prop-1', { status: 'requested' });

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', { status: 'requested' });
    });
  });
});
