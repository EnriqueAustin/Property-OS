import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RatePlansService } from './rate-plans.service';
import { RatePlan } from './entities/rate-plan.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'rp-1', ...data })),
  remove: jest.fn(),
};

const mockRatePlan = (overrides: any = {}) => ({
  id: 'rp-1',
  property_id: 'prop-1',
  room_type_id: 'rt-1',
  name: 'Standard Rate',
  is_active: true,
  sort_order: 0,
  ...overrides,
});

describe('RatePlansService', () => {
  let service: RatePlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatePlansService,
        { provide: getRepositoryToken(RatePlan), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<RatePlansService>(RatePlansService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return all rate plans for a property', async () => {
      mockRepo.find.mockResolvedValue([mockRatePlan(), mockRatePlan({ id: 'rp-2' })]);

      const result = await service.list('prop-1');

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { property_id: 'prop-1' } }),
      );
    });

    it('should filter by room type when provided', async () => {
      mockRepo.find.mockResolvedValue([mockRatePlan()]);

      await service.list('prop-1', 'rt-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { property_id: 'prop-1', room_type_id: 'rt-1' },
        }),
      );
    });
  });

  describe('getOne', () => {
    it('should return a rate plan by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockRatePlan());

      const result = await service.getOne('prop-1', 'rp-1');

      expect(result.name).toBe('Standard Rate');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getOne('prop-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new rate plan', async () => {
      const result = await service.create('prop-1', {
        name: 'Early Bird',
        room_type_id: 'rt-1',
      } as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ property_id: 'prop-1', name: 'Early Bird' }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update an existing rate plan', async () => {
      mockRepo.findOne.mockResolvedValue(mockRatePlan());
      mockRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.update('prop-1', 'rp-1', { name: 'Updated' } as any);

      expect(result.name).toBe('Updated');
    });

    it('should throw when rate plan not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update('prop-1', 'nope', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an existing rate plan', async () => {
      mockRepo.findOne.mockResolvedValue(mockRatePlan());

      await service.remove('prop-1', 'rp-1');

      expect(mockRepo.remove).toHaveBeenCalled();
    });

    it('should throw when rate plan not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('prop-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveForRoomType', () => {
    it('should return only active rate plans for a room type', async () => {
      mockRepo.find.mockResolvedValue([mockRatePlan()]);

      const result = await service.getActiveForRoomType('prop-1', 'rt-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { property_id: 'prop-1', room_type_id: 'rt-1', is_active: true },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
