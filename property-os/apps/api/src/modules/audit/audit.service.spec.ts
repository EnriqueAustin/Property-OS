import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

const mockAuditRepo = {
  create: jest.fn((dto) => dto),
  save: jest.fn((entity) => Promise.resolve({ id: 'audit-1', ...entity })),
  createQueryBuilder: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create and save an audit entry', async () => {
      const entry = {
        propertyId: 'prop-1',
        userId: 'user-1',
        action: 'create',
        entityType: 'booking',
        entityId: 'booking-1',
        newValues: { status: 'confirmed' },
      };

      const result = await service.log(entry);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'prop-1',
          action: 'create',
          entity_type: 'booking',
        }),
      );
      expect(result.id).toBe('audit-1');
    });

    it('should handle entries without optional fields', async () => {
      const entry = {
        action: 'login',
        entityType: 'user',
      };

      await service.log(entry);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'login',
          entity_type: 'user',
          property_id: undefined,
        }),
      );
    });
  });

  describe('listLogs', () => {
    it('should return paginated audit logs', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'audit-1', action: 'create' }], 1]),
      };
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listLogs('prop-1', { page: 1, limit: 30 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by entityType', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listLogs('prop-1', { entityType: 'booking' });

      expect(qb.andWhere).toHaveBeenCalledWith('a.entity_type = :et', { et: 'booking' });
    });

    it('should filter by action', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listLogs('prop-1', { action: 'cancel' });

      expect(qb.andWhere).toHaveBeenCalledWith('a.action = :action', { action: 'cancel' });
    });
  });

  describe('event listeners', () => {
    it('should log booking.created event', async () => {
      await service.onBookingCreated({
        propertyId: 'prop-1',
        bookingId: 'b-1',
        referenceNumber: 'POS-2026-0001',
        source: 'direct',
      });

      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entity_type: 'booking',
          entity_id: 'b-1',
        }),
      );
    });

    it('should log booking.cancelled event', async () => {
      await service.onBookingCancelled({
        propertyId: 'prop-1',
        bookingId: 'b-1',
        reason: 'Guest request',
      });

      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          entity_type: 'booking',
        }),
      );
    });

    it('should log payment.completed event', async () => {
      await service.onPaymentCompleted({
        propertyId: 'prop-1',
        paymentId: 'pay-1',
        bookingId: 'b-1',
        amount: 5000,
        provider: 'payfast',
      });

      expect(mockAuditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_completed',
          entity_type: 'payment',
        }),
      );
    });
  });
});
