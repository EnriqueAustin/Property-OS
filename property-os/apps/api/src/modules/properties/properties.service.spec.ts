import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PropertiesService } from './properties.service';
import { Property } from './entities/property.entity';
import { PropertyUser } from './entities/property-user.entity';
import { CacheService } from '../../common/cache/cache.service';

const mockProperty = {
  id: 'prop-1',
  name: 'Seaside Guesthouse',
  slug: 'seaside-guesthouse',
  description: 'A lovely guesthouse',
  property_type: 'guesthouse',
  is_active: true,
  is_published: true,
  min_stay_nights: 1,
  max_stay_nights: 21,
  advance_booking_days: 365,
  deposit_required: true,
  deposit_percentage: 50,
  cancellation_policy: 'Free cancellation 48h before check-in',
};

const mockPropertiesRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockPropertyUsersRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn(),
  query: jest.fn(),
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
};

describe('PropertiesService', () => {
  let service: PropertiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: getRepositoryToken(Property), useValue: mockPropertiesRepo },
        { provide: getRepositoryToken(PropertyUser), useValue: mockPropertyUsersRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    jest.clearAllMocks();
  });

  describe('listForUser', () => {
    it('should return properties linked to the user', async () => {
      mockPropertyUsersRepo.find.mockResolvedValue([
        { property: mockProperty, user_id: 'user-1', is_active: true },
      ]);

      const result = await service.listForUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Seaside Guesthouse');
    });

    it('should return empty array when user has no properties', async () => {
      mockPropertyUsersRepo.find.mockResolvedValue([]);

      const result = await service.listForUser('user-2');
      expect(result).toHaveLength(0);
    });
  });

  describe('findOneForUser', () => {
    it('should return property when user has access', async () => {
      mockPropertyUsersRepo.findOne.mockResolvedValue({
        property: mockProperty,
        user_id: 'user-1',
        property_id: 'prop-1',
      });

      const result = await service.findOneForUser('user-1', 'prop-1');
      expect(result.id).toBe('prop-1');
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockPropertyUsersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForUser('user-2', 'prop-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update property fields', async () => {
      mockPropertiesRepo.findOne.mockResolvedValue({ ...mockProperty });
      mockPropertiesRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update('prop-1', { description: 'Updated description' });

      expect(result.description).toBe('Updated description');
    });

    it('should regenerate slug when name changes', async () => {
      const prop = { ...mockProperty };
      mockPropertiesRepo.findOne
        .mockResolvedValueOnce(prop)
        .mockResolvedValueOnce(null);
      mockPropertiesRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update('prop-1', { name: 'Mountain Lodge' });

      expect(result.slug).toBe('mountain-lodge');
    });

    it('should throw NotFoundException for unknown property', async () => {
      mockPropertiesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('unknown', { description: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBookingSettings', () => {
    it('should return booking settings', async () => {
      mockPropertiesRepo.findOne.mockResolvedValue(mockProperty);

      const result = await service.getBookingSettings('prop-1');

      expect(result.deposit_required).toBe(true);
      expect(result.deposit_percentage).toBe(50);
      expect(result.min_stay_nights).toBe(1);
    });

    it('should throw NotFoundException for unknown property', async () => {
      mockPropertiesRepo.findOne.mockResolvedValue(null);

      await expect(service.getBookingSettings('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBookingSettings', () => {
    it('should update booking settings and return them', async () => {
      const prop = { ...mockProperty };
      mockPropertiesRepo.findOne.mockResolvedValue(prop);
      mockPropertiesRepo.save.mockImplementation((p) => Promise.resolve({ ...p, id: 'prop-1' }));

      mockPropertiesRepo.findOne.mockResolvedValue({
        ...prop,
        min_stay_nights: 2,
      });

      const result = await service.updateBookingSettings('prop-1', { min_stay_nights: 2 });

      expect(result.min_stay_nights).toBe(2);
    });
  });

  describe('getDashboard', () => {
    it('should return cached data when available', async () => {
      const cachedDashboard = { property: { id: 'prop-1', name: 'Cached' }, kpis: {} };
      mockCache.get.mockResolvedValue(cachedDashboard);

      const result = await service.getDashboard('prop-1');

      expect(result).toEqual(cachedDashboard);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should query database and cache result when not cached', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPropertiesRepo.findOne.mockResolvedValue(mockProperty);
      mockDataSource.query.mockResolvedValue([{ booked: '5', total: '10', revenue: '5000', cnt: '3', source: 'direct', count: '3' }]);

      const result = await service.getDashboard('prop-1');

      expect(result.property.name).toBe('Seaside Guesthouse');
      expect(mockCache.set).toHaveBeenCalledWith(
        'dashboard:prop-1',
        expect.any(Object),
        120,
      );
    });
  });
});
