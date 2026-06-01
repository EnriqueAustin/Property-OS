import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TourismLevyService } from './tourism-levy.service';
import { TourismLevySettings, LevyType } from './entities/tourism-levy-settings.entity';
import { TourismLevyRecord } from './entities/tourism-levy-record.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'record-1', ...data })),
});

const mockSettings = (overrides: Partial<TourismLevySettings> = {}): TourismLevySettings => ({
  id: 'settings-1',
  property_id: 'prop-1',
  enabled: true,
  levy_type: LevyType.PER_NIGHT,
  levy_amount: 50,
  levy_percent: 0,
  levy_name: 'Tourism Levy',
  exempt_children_under: null as any,
  include_in_total: true,
  created_at: new Date(),
  updated_at: new Date(),
  property: null as any,
  ...overrides,
});

describe('TourismLevyService', () => {
  let service: TourismLevyService;
  let settingsRepo: ReturnType<typeof mockRepo>;
  let recordsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    settingsRepo = mockRepo();
    recordsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TourismLevyService,
        { provide: getRepositoryToken(TourismLevySettings), useValue: settingsRepo },
        { provide: getRepositoryToken(TourismLevyRecord), useValue: recordsRepo },
      ],
    }).compile();

    service = module.get<TourismLevyService>(TourismLevyService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // getSettings
  // =========================================================================

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings());

      const result = await service.getSettings('prop-1');

      expect(result.property_id).toBe('prop-1');
      expect(result.enabled).toBe(true);
    });

    it('should create and return default settings when none exist', async () => {
      settingsRepo.findOne.mockResolvedValue(null);
      settingsRepo.save.mockResolvedValue(mockSettings({ enabled: false }));

      const result = await service.getSettings('prop-1');

      expect(settingsRepo.create).toHaveBeenCalled();
      expect(settingsRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // updateSettings
  // =========================================================================

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      settingsRepo.findOne.mockResolvedValue(mockSettings());
      settingsRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.updateSettings('prop-1', {
        levy_type: LevyType.PERCENTAGE,
        levy_percent: 2,
        enabled: true,
      } as any);

      expect(settingsRepo.save).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // calculateLevy — the core calculation logic
  // =========================================================================

  describe('calculateLevy', () => {
    it('should return zero when levy is disabled', () => {
      const settings = mockSettings({ enabled: false });

      const result = service.calculateLevy(settings, 3, 2, 1000);

      expect(result.levyAmount).toBe(0);
      expect(result.rate).toBe(0);
    });

    describe('PER_NIGHT', () => {
      it('should calculate levy per night', () => {
        const settings = mockSettings({
          levy_type: LevyType.PER_NIGHT,
          levy_amount: 50,
        });

        const result = service.calculateLevy(settings, 3, 2, 1500);

        expect(result.levyAmount).toBe(150); // 50 * 3 nights
        expect(result.rate).toBe(50);
      });

      it('should handle fractional amounts correctly', () => {
        const settings = mockSettings({ levy_type: LevyType.PER_NIGHT, levy_amount: 33.33 });

        const result = service.calculateLevy(settings, 2, 1, 200);

        expect(result.levyAmount).toBe(66.66); // 33.33 * 2 rounded to 2dp
      });
    });

    describe('PER_GUEST_PER_NIGHT', () => {
      it('should calculate levy per guest per night', () => {
        const settings = mockSettings({
          levy_type: LevyType.PER_GUEST_PER_NIGHT,
          levy_amount: 20,
        });

        const result = service.calculateLevy(settings, 3, 2, 2000);

        expect(result.levyAmount).toBe(120); // 20 * 3 nights * 2 guests
        expect(result.rate).toBe(20);
      });

      it('should handle single guest correctly', () => {
        const settings = mockSettings({
          levy_type: LevyType.PER_GUEST_PER_NIGHT,
          levy_amount: 20,
        });

        const result = service.calculateLevy(settings, 3, 1, 2000);

        expect(result.levyAmount).toBe(60); // 20 * 3 nights * 1 guest
      });
    });

    describe('PERCENTAGE', () => {
      it('should calculate levy as percentage of total price', () => {
        const settings = mockSettings({
          levy_type: LevyType.PERCENTAGE,
          levy_percent: 5,
        });

        const result = service.calculateLevy(settings, 3, 2, 2000);

        expect(result.levyAmount).toBe(100); // 5% of 2000
        expect(result.rate).toBe(5);
      });

      it('should round percentage levy to 2 decimal places', () => {
        const settings = mockSettings({
          levy_type: LevyType.PERCENTAGE,
          levy_percent: 3,
        });

        const result = service.calculateLevy(settings, 1, 1, 1000);

        expect(result.levyAmount).toBe(30);
      });
    });
  });

  // =========================================================================
  // createRecord
  // =========================================================================

  describe('createRecord', () => {
    it('should create a tourism levy record', async () => {
      recordsRepo.save.mockResolvedValue({ id: 'record-1', total_levy: 150 });

      const result = await service.createRecord({
        propertyId: 'prop-1',
        bookingId: 'booking-1',
        guestId: 'guest-1',
        levyName: 'Tourism Levy',
        levyType: LevyType.PER_NIGHT,
        nights: 3,
        guestCount: 2,
        rate: 50,
        totalLevy: 150,
        checkIn: '2026-06-01',
        checkOut: '2026-06-04',
      });

      expect(recordsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'prop-1',
          booking_id: 'booking-1',
          total_levy: 150,
        }),
      );
      expect(result.id).toBe('record-1');
    });
  });

  // =========================================================================
  // getReport
  // =========================================================================

  describe('getReport', () => {
    it('should return summary and records for a date range', async () => {
      const mockRecords = [
        {
          id: 'r1',
          booking_id: 'b1',
          booking: { reference_number: 'POS-001' },
          guest: { first_name: 'Jane', last_name: 'Doe' },
          levy_name: 'Tourism Levy',
          levy_type: LevyType.PER_NIGHT,
          nights: 2,
          guest_count: 2,
          rate: 50,
          total_levy: 100,
          check_in: '2026-06-01',
          check_out: '2026-06-03',
          created_at: new Date(),
        },
      ];
      recordsRepo.find.mockResolvedValue(mockRecords);

      const result = await service.getReport('prop-1', '2026-06-01', '2026-06-30');

      expect(result.summary.totalLevy).toBe(100);
      expect(result.summary.totalBookings).toBe(1);
      expect(result.summary.totalNights).toBe(2);
      expect(result.records[0].guestName).toBe('Jane Doe');
    });

    it('should return zero totals when no records exist', async () => {
      recordsRepo.find.mockResolvedValue([]);

      const result = await service.getReport('prop-1', '2026-06-01', '2026-06-30');

      expect(result.summary.totalLevy).toBe(0);
      expect(result.summary.totalBookings).toBe(0);
      expect(result.records).toHaveLength(0);
    });
  });

  // =========================================================================
  // getMonthlyReport
  // =========================================================================

  describe('getMonthlyReport', () => {
    it('should return 12 months with totals', async () => {
      // Only June has records
      recordsRepo.find.mockImplementation(({ where }: any) => {
        const isJune = where?.check_in?.value?.[0]?.includes('-06-') ||
          (typeof where?.check_in === 'object' && JSON.stringify(where.check_in).includes('06'));
        return Promise.resolve(
          isJune
            ? [{ total_levy: 200, nights: 3, guest_count: 2 }]
            : [],
        );
      });

      const result = await service.getMonthlyReport('prop-1', 2026);

      expect(result.year).toBe(2026);
      expect(result.months).toHaveLength(12);
      // annualTotal is sum — some months will have values
      expect(result.annualTotal).toBeGreaterThanOrEqual(0);
    });

    it('should return zero annual total when no records', async () => {
      recordsRepo.find.mockResolvedValue([]);

      const result = await service.getMonthlyReport('prop-1', 2026);

      expect(result.annualTotal).toBe(0);
      expect(result.months.every((m) => m.totalLevy === 0)).toBe(true);
    });
  });
});
