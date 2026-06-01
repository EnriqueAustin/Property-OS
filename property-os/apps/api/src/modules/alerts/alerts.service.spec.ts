import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AlertsService } from './alerts.service';
import { SmartAlert, AlertType, AlertSeverity, AlertStatus } from './entities/smart-alert.entity';
import { AlertSettings } from './entities/alert-settings.entity';
import { Property } from '../properties/entities/property.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'alert-1', ...data })),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockDataSource = {
  query: jest.fn(),
};

const mockSettings = (overrides: Partial<AlertSettings> = {}): AlertSettings => ({
  id: 'settings-1',
  property_id: 'prop-1',
  enabled: true,
  low_occupancy_threshold: 30,
  low_occupancy_lookahead_days: 14,
  no_bookings_days: 7,
  high_cancellation_threshold: 25,
  revenue_drop_threshold: 20,
  email_alerts: true,
  created_at: new Date(),
  updated_at: new Date(),
  property: null as any,
  ...overrides,
});

describe('AlertsService', () => {
  let service: AlertsService;
  let alertsRepo: ReturnType<typeof mockRepo>;
  let settingsRepo: ReturnType<typeof mockRepo>;
  let propertiesRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    alertsRepo = mockRepo();
    settingsRepo = mockRepo();
    propertiesRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(SmartAlert), useValue: alertsRepo },
        { provide: getRepositoryToken(AlertSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(Property), useValue: propertiesRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // CRUD
  // =========================================================================

  describe('listAlerts', () => {
    it('should return paginated alerts with meta', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'alert-1' }], 1]),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listAlerts('prop-1');

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply status filter when provided', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listAlerts('prop-1', 'active');

      expect(qb.andWhere).toHaveBeenCalledWith('a.status = :status', { status: 'active' });
    });

    it('should paginate correctly', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 50]),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listAlerts('prop-1', undefined, 3, 10);

      expect(qb.skip).toHaveBeenCalledWith(20); // (3-1)*10
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.meta.totalPages).toBe(5);
    });
  });

  describe('updateAlert', () => {
    it('should update alert status to acknowledged and set acknowledged_at', async () => {
      alertsRepo.findOne.mockResolvedValue({ id: 'alert-1', status: AlertStatus.ACTIVE });
      alertsRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.updateAlert('alert-1', AlertStatus.ACKNOWLEDGED);

      expect(alertsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AlertStatus.ACKNOWLEDGED,
          acknowledged_at: expect.any(Date),
        }),
      );
    });

    it('should update alert status to dismissed', async () => {
      alertsRepo.findOne.mockResolvedValue({ id: 'alert-1', status: AlertStatus.ACTIVE });
      alertsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.updateAlert('alert-1', AlertStatus.DISMISSED);

      expect(alertsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AlertStatus.DISMISSED }),
      );
    });

    it('should throw NotFoundException when alert not found', async () => {
      alertsRepo.findOne.mockResolvedValue(null);

      await expect(service.updateAlert('nope', AlertStatus.DISMISSED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAlertCounts', () => {
    it('should return counts per status', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'active', count: '3' },
          { status: 'dismissed', count: '1' },
        ]),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAlertCounts('prop-1');

      expect(result.active).toBe(3);
      expect(result.dismissed).toBe(1);
      expect(result.acknowledged).toBe(0);
    });
  });

  // =========================================================================
  // Settings
  // =========================================================================

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings());

      const result = await service.getSettings('prop-1');

      expect(result.enabled).toBe(true);
    });

    it('should create and return default settings when none exist', async () => {
      settingsRepo.findOne.mockResolvedValue(null);
      settingsRepo.save.mockResolvedValue(mockSettings({ enabled: false }));

      const result = await service.getSettings('prop-1');

      expect(settingsRepo.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateSettings', () => {
    it('should update settings fields', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings());
      settingsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.updateSettings('prop-1', {
        enabled: false,
        lowOccupancyThreshold: 20,
        noBookingsDays: 5,
      });

      expect(settingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          low_occupancy_threshold: 20,
          no_bookings_days: 5,
        }),
      );
    });
  });

  // =========================================================================
  // scanProperty (internal logic)
  // =========================================================================

  describe('scanProperty', () => {
    it('should skip scanning when alerts are disabled', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings({ enabled: false }));

      await service.scanProperty('prop-1');

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should run all four checks when alerts are enabled', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings({ enabled: true }));

      // Mock dataSource.query for all four checks — return data that does NOT trigger alerts
      mockDataSource.query
        // checkLowOccupancy — 80% booked, above threshold
        .mockResolvedValueOnce([{ booked: '8', total: '10' }])
        // checkNoBookings — has bookings
        .mockResolvedValueOnce([{ cnt: '3' }])
        // checkHighCancellation — below 5 total (skip)
        .mockResolvedValueOnce([{ total: '2', cancelled: '0' }])
        // suggestPricing — 50% occupancy (no alert)
        .mockResolvedValueOnce([{ booked: '5', total: '10' }]);

      // createAlertIfNew — no recent alerts
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.scanProperty('prop-1');

      expect(mockDataSource.query).toHaveBeenCalledTimes(4);
    });

    it('should create low-occupancy alert when occupancy is below threshold', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings({ low_occupancy_threshold: 30 }));

      mockDataSource.query
        // checkLowOccupancy — 10% booked
        .mockResolvedValueOnce([{ booked: '1', total: '10' }])
        // checkNoBookings
        .mockResolvedValueOnce([{ cnt: '5' }])
        // checkHighCancellation
        .mockResolvedValueOnce([{ total: '3', cancelled: '0' }])
        // suggestPricing
        .mockResolvedValueOnce([{ booked: '1', total: '10' }]);

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0), // no recent alert
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.scanProperty('prop-1');

      // Should have tried to create at least one alert (low occupancy + pricing)
      expect(alertsRepo.create).toHaveBeenCalled();
      expect(alertsRepo.save).toHaveBeenCalled();
    });

    it('should NOT create alert when one already exists within 24 hours', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings());

      // Low occupancy scenario
      mockDataSource.query
        .mockResolvedValueOnce([{ booked: '1', total: '10' }])
        .mockResolvedValueOnce([{ cnt: '5' }])
        .mockResolvedValueOnce([{ total: '3', cancelled: '0' }])
        .mockResolvedValueOnce([{ booked: '1', total: '10' }]);

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1), // recent alert exists
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.scanProperty('prop-1');

      expect(alertsRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // scanAllProperties
  // =========================================================================

  describe('scanAllProperties', () => {
    it('should scan all active properties', async () => {
      propertiesRepo.find.mockResolvedValue([
        { id: 'prop-1', is_active: true },
        { id: 'prop-2', is_active: true },
      ]);

      // Make scanProperty a no-op via settings disabled
      settingsRepo.findOne.mockResolvedValue(mockSettings({ enabled: false }));

      await service.scanAllProperties();

      expect(settingsRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should continue scanning other properties when one fails', async () => {
      propertiesRepo.find.mockResolvedValue([
        { id: 'prop-1', is_active: true },
        { id: 'prop-2', is_active: true },
      ]);

      settingsRepo.findOne
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(mockSettings({ enabled: false }));

      // Should not throw
      await expect(service.scanAllProperties()).resolves.not.toThrow();
    });
  });
});
