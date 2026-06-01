import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PromosService } from './promos.service';
import { PromoCode, DiscountType } from './entities/promo-code.entity';
import { Property } from '../properties/entities/property.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'promo-1', ...data })),
  remove: jest.fn(),
});

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

const mockPromo = (overrides: Partial<PromoCode> = {}): PromoCode => ({
  id: 'promo-1',
  property_id: 'prop-1',
  code: 'SAVE20',
  description: '20% off',
  discount_type: DiscountType.PERCENTAGE,
  discount_value: 20,
  valid_from: null as any,
  valid_to: null as any,
  usage_limit: null as any,
  usage_count: 0,
  min_nights: null as any,
  min_amount: null as any,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  property: null as any,
  ...overrides,
});

describe('PromosService', () => {
  let service: PromosService;
  let promosRepo: ReturnType<typeof mockRepo>;
  let propertiesRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    promosRepo = mockRepo();
    propertiesRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromosService,
        { provide: getRepositoryToken(PromoCode), useValue: promosRepo },
        { provide: getRepositoryToken(Property), useValue: propertiesRepo },
      ],
    }).compile();

    service = module.get<PromosService>(PromosService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // CRUD
  // =========================================================================

  describe('create', () => {
    it('should create a promo code when none exists', async () => {
      promosRepo.findOne.mockResolvedValue(null);
      promosRepo.save.mockResolvedValue(mockPromo());

      const result = await service.create('prop-1', {
        code: 'SAVE20',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
      } as any);

      expect(result.code).toBe('SAVE20');
    });

    it('should throw BadRequestException when code already exists for property', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo());

      await expect(
        service.create('prop-1', { code: 'SAVE20', discountType: DiscountType.PERCENTAGE, discountValue: 20 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('should return all promo codes for a property', async () => {
      promosRepo.find.mockResolvedValue([mockPromo(), mockPromo({ id: 'promo-2', code: 'FLAT50' })]);

      const result = await service.list('prop-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getOne', () => {
    it('should return a single promo code', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo());

      const result = await service.getOne('prop-1', 'promo-1');
      expect(result.code).toBe('SAVE20');
    });

    it('should throw NotFoundException when promo not found', async () => {
      promosRepo.findOne.mockResolvedValue(null);

      await expect(service.getOne('prop-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update promo code fields', async () => {
      const existing = mockPromo();
      promosRepo.findOne.mockResolvedValue(existing);
      promosRepo.save.mockResolvedValue({ ...existing, description: 'Updated' });

      const result = await service.update('prop-1', 'promo-1', { description: 'Updated' } as any);

      expect(result.description).toBe('Updated');
    });

    it('should set is_active=false when deactivating', async () => {
      const existing = mockPromo();
      promosRepo.findOne.mockResolvedValue(existing);
      promosRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));

      await service.update('prop-1', 'promo-1', { isActive: false } as any);

      expect(promosRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    });
  });

  describe('remove', () => {
    it('should remove an existing promo code', async () => {
      const existing = mockPromo();
      promosRepo.findOne.mockResolvedValue(existing);
      promosRepo.remove.mockResolvedValue(undefined);

      await service.remove('prop-1', 'promo-1');

      expect(promosRepo.remove).toHaveBeenCalledWith(existing);
    });
  });

  // =========================================================================
  // validate
  // =========================================================================

  describe('validate', () => {
    it('should return valid=true for an active unrestricted promo', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo());

      const result = await service.validate('prop-1', 'save20');

      expect(result.valid).toBe(true);
      expect(result.discountType).toBe(DiscountType.PERCENTAGE);
      expect(result.discountValue).toBe(20);
    });

    it('should return valid=false when promo code not found', async () => {
      promosRepo.findOne.mockResolvedValue(null);

      const result = await service.validate('prop-1', 'NOPE');

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/invalid/i);
    });

    it('should return valid=false when promo not yet active', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ valid_from: nextMonth }));

      const result = await service.validate('prop-1', 'SAVE20');

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/not yet active/i);
    });

    it('should return valid=false when promo has expired', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ valid_to: yesterday }));

      const result = await service.validate('prop-1', 'SAVE20');

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/expired/i);
    });

    it('should return valid=false when usage limit reached', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ usage_limit: 10, usage_count: 10 }));

      const result = await service.validate('prop-1', 'SAVE20');

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/usage limit/i);
    });

    it('should return valid=false when min_nights not met', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ min_nights: 3 }));

      const result = await service.validate('prop-1', 'SAVE20', 2);

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/minimum/i);
    });

    it('should return valid=true when nights meets min_nights exactly', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ min_nights: 3 }));

      const result = await service.validate('prop-1', 'SAVE20', 3);

      expect(result.valid).toBe(true);
    });

    it('should return valid=false when min_amount not met', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ min_amount: 1000 }));

      const result = await service.validate('prop-1', 'SAVE20', undefined, 500);

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/minimum booking amount/i);
    });
  });

  // =========================================================================
  // applyDiscount
  // =========================================================================

  describe('applyDiscount', () => {
    it('should apply percentage discount correctly', async () => {
      promosRepo.findOne.mockResolvedValue(mockPromo({ discount_type: DiscountType.PERCENTAGE, discount_value: 20 }));
      promosRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.applyDiscount('prop-1', 'SAVE20', 1000);

      expect(result.discountAmount).toBe(200);
      expect(result.discountedPrice).toBe(800);
    });

    it('should apply fixed discount correctly', async () => {
      promosRepo.findOne.mockResolvedValue(
        mockPromo({ discount_type: DiscountType.FIXED, discount_value: 150 }),
      );
      promosRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.applyDiscount('prop-1', 'SAVE20', 1000);

      expect(result.discountAmount).toBe(150);
      expect(result.discountedPrice).toBe(850);
    });

    it('should cap fixed discount at total price', async () => {
      promosRepo.findOne.mockResolvedValue(
        mockPromo({ discount_type: DiscountType.FIXED, discount_value: 2000 }),
      );
      promosRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.applyDiscount('prop-1', 'SAVE20', 500);

      expect(result.discountAmount).toBe(500);
      expect(result.discountedPrice).toBe(0);
    });

    it('should increment usage_count on apply', async () => {
      const promo = mockPromo({ usage_count: 3 });
      promosRepo.findOne.mockResolvedValue(promo);
      promosRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.applyDiscount('prop-1', 'SAVE20', 1000);

      expect(promosRepo.save).toHaveBeenCalledWith(expect.objectContaining({ usage_count: 4 }));
    });

    it('should return unchanged price when promo not found', async () => {
      promosRepo.findOne.mockResolvedValue(null);

      const result = await service.applyDiscount('prop-1', 'NOPE', 1000);

      expect(result.discountedPrice).toBe(1000);
      expect(result.discountAmount).toBe(0);
    });
  });

  // =========================================================================
  // validateBySlug
  // =========================================================================

  describe('validateBySlug', () => {
    it('should validate promo by property slug', async () => {
      propertiesRepo.findOne.mockResolvedValue({ id: 'prop-1' });
      promosRepo.findOne.mockResolvedValue(mockPromo());

      const result = await service.validateBySlug('my-property', 'SAVE20');

      expect(result.valid).toBe(true);
    });

    it('should throw NotFoundException when property slug not found', async () => {
      propertiesRepo.findOne.mockResolvedValue(null);

      await expect(service.validateBySlug('nope', 'SAVE20')).rejects.toThrow(NotFoundException);
    });
  });
});
