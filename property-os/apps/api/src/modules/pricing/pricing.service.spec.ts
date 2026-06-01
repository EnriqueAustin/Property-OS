import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingRule, PricingRuleType } from './entities/pricing-rule.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'rule-1', ...data })),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockRule = (overrides: Partial<PricingRule> = {}): PricingRule => ({
  id: 'rule-1',
  property_id: 'prop-1',
  room_type_id: null as any,
  name: 'Weekend Uplift',
  rule_type: PricingRuleType.WEEKEND,
  modifier_percent: 20,
  days_before_checkin: null as any,
  min_nights: null as any,
  occupancy_threshold_percent: null as any,
  priority: 10,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  property: null as any,
  room_type: null as any,
  ...overrides,
});

describe('PricingService', () => {
  let service: PricingService;
  let rulesRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    rulesRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(PricingRule), useValue: rulesRepo },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // CRUD operations
  // =========================================================================

  describe('create', () => {
    it('should create a pricing rule for a property', async () => {
      const dto = {
        name: 'Weekend Uplift',
        rule_type: PricingRuleType.WEEKEND,
        modifier_percent: 20,
        priority: 10,
        is_active: true,
      };

      rulesRepo.save.mockResolvedValue(mockRule());

      const result = await service.create('prop-1', dto as any);

      expect(rulesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ property_id: 'prop-1', name: 'Weekend Uplift' }),
      );
      expect(result.id).toBe('rule-1');
    });
  });

  describe('list', () => {
    it('should return all rules for a property ordered by priority', async () => {
      rulesRepo.find.mockResolvedValue([mockRule(), mockRule({ id: 'rule-2', priority: 5 })]);

      const result = await service.list('prop-1');

      expect(rulesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { property_id: 'prop-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update an existing rule', async () => {
      const existing = mockRule();
      rulesRepo.findOne.mockResolvedValue(existing);
      rulesRepo.save.mockResolvedValue({ ...existing, modifier_percent: 25 });

      const result = await service.update('rule-1', { modifier_percent: 25 } as any);

      expect(result.modifier_percent).toBe(25);
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      rulesRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nope', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an existing rule', async () => {
      const existing = mockRule();
      rulesRepo.findOne.mockResolvedValue(existing);
      rulesRepo.remove.mockResolvedValue(undefined);

      await service.remove('rule-1');

      expect(rulesRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      rulesRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkCreate', () => {
    it('should create rules for multiple properties', async () => {
      const created = [
        mockRule({ property_id: 'prop-1' }),
        mockRule({ id: 'rule-2', property_id: 'prop-2' }),
      ];
      rulesRepo.save.mockResolvedValue(created);

      const result = await service.bulkCreate({
        property_ids: ['prop-1', 'prop-2'],
        name: 'Weekend Uplift',
        rule_type: PricingRuleType.WEEKEND,
        modifier_percent: 20,
        priority: 10,
      } as any);

      expect(rulesRepo.create).toHaveBeenCalledTimes(2);
      expect(rulesRepo.save).toHaveBeenCalled();
    });
  });

  describe('listAcrossProperties', () => {
    it('should return empty array when no property IDs provided', async () => {
      const result = await service.listAcrossProperties([]);
      expect(result).toEqual([]);
      expect(rulesRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should query rules across multiple properties', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRule()]),
      };
      rulesRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listAcrossProperties(['prop-1', 'prop-2']);

      expect(qb.where).toHaveBeenCalledWith('r.property_id IN (:...ids)', { ids: ['prop-1', 'prop-2'] });
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // calculatePrice — the core pricing logic
  // =========================================================================

  describe('calculatePrice', () => {
    const basePrice = 1000;
    const propId = 'prop-1';
    const rtId = 'rt-1';

    const weekendDate = '2026-06-06'; // Saturday

    it('should return base price when no active rules exist', async () => {
      rulesRepo.find.mockResolvedValue([]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 2, 50);

      expect(result.price).toBe(basePrice);
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should apply weekend rule on a weekend night', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({ rule_type: PricingRuleType.WEEKEND, modifier_percent: 20 }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 2, 50);

      expect(result.price).toBe(1200); // +20%
      expect(result.appliedRules).toContain('Weekend Uplift');
    });

    it('should NOT apply weekend rule on a weekday', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({ rule_type: PricingRuleType.WEEKEND, modifier_percent: 20 }),
      ]);

      // 2026-06-08 is a Monday
      const result = await service.calculatePrice(propId, rtId, basePrice, '2026-06-08', 0, 2, 50);

      expect(result.price).toBe(basePrice);
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should apply weekday rule on a weekday', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({ name: 'Weekday Discount', rule_type: PricingRuleType.WEEKDAY, modifier_percent: -10 }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, '2026-06-08', 0, 2, 50);

      expect(result.price).toBe(900);
      expect(result.appliedRules).toContain('Weekday Discount');
    });

    it('should apply last_minute rule when check-in is within threshold', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({
          name: 'Last Minute',
          rule_type: PricingRuleType.LAST_MINUTE,
          modifier_percent: -15,
          days_before_checkin: 3,
        }),
      ]);

      // Tomorrow's date to ensure daysUntilCheckin is <= 3
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const result = await service.calculatePrice(propId, rtId, basePrice, tomorrowStr, 0, 1, 50);

      expect(result.price).toBe(850);
      expect(result.appliedRules).toContain('Last Minute');
    });

    it('should apply early_bird rule when booking far in advance', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({
          name: 'Early Bird',
          rule_type: PricingRuleType.EARLY_BIRD,
          modifier_percent: -10,
          days_before_checkin: 30,
        }),
      ]);

      // 60 days from now
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const futureStr = future.toISOString().slice(0, 10);

      const result = await service.calculatePrice(propId, rtId, basePrice, futureStr, 0, 5, 50);

      expect(result.price).toBe(900);
      expect(result.appliedRules).toContain('Early Bird');
    });

    it('should apply length_of_stay rule when nights >= threshold', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({
          name: 'Long Stay Discount',
          rule_type: PricingRuleType.LENGTH_OF_STAY,
          modifier_percent: -5,
          min_nights: 7,
        }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 7, 50);

      expect(result.price).toBe(950);
      expect(result.appliedRules).toContain('Long Stay Discount');
    });

    it('should NOT apply length_of_stay rule when nights < threshold', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({
          name: 'Long Stay Discount',
          rule_type: PricingRuleType.LENGTH_OF_STAY,
          modifier_percent: -5,
          min_nights: 7,
        }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 3, 50);

      expect(result.price).toBe(basePrice);
    });

    it('should apply occupancy rule when occupancy >= threshold', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({
          name: 'High Demand Surge',
          rule_type: PricingRuleType.OCCUPANCY,
          modifier_percent: 30,
          occupancy_threshold_percent: 80,
        }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 2, 90);

      expect(result.price).toBe(1300);
      expect(result.appliedRules).toContain('High Demand Surge');
    });

    it('should stack multiple applicable rules in priority order', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({ name: 'Weekend', rule_type: PricingRuleType.WEEKEND, modifier_percent: 20, priority: 10 }),
        mockRule({ id: 'rule-2', name: 'High Demand', rule_type: PricingRuleType.OCCUPANCY, modifier_percent: 10, occupancy_threshold_percent: 80, priority: 5 }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 2, 90);

      // 1000 * 1.2 = 1200, then 1200 * 1.1 = 1320
      expect(result.price).toBe(1320);
      expect(result.appliedRules).toHaveLength(2);
    });

    it('should skip rule when room_type_id does not match', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({ rule_type: PricingRuleType.WEEKEND, modifier_percent: 20, room_type_id: 'rt-other' }),
      ]);

      const result = await service.calculatePrice(propId, 'rt-1', basePrice, weekendDate, 0, 2, 50);

      expect(result.price).toBe(basePrice);
    });

    it('should never return negative price', async () => {
      rulesRepo.find.mockResolvedValue([
        mockRule({ rule_type: PricingRuleType.WEEKEND, modifier_percent: -200 }),
      ]);

      const result = await service.calculatePrice(propId, rtId, basePrice, weekendDate, 0, 2, 50);

      expect(result.price).toBe(0);
    });
  });
});
