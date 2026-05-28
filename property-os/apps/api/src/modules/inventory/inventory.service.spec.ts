import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryService } from './inventory.service';
import { RoomType } from './entities/room-type.entity';
import { RoomAmenity } from './entities/room-amenity.entity';
import { Room } from './entities/room.entity';
import { RoomAvailability, AvailabilityStatus } from './entities/room-availability.entity';
import { RatePeriod } from './entities/rate-period.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'new-id', ...data })),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    execute: jest.fn().mockResolvedValue({ affected: 3 }),
  })),
});

const mockManager = {
  query: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((_, data) => data),
  save: jest.fn((data) => ({ id: 'new-id', ...data })),
  delete: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockManager)),
};

describe('InventoryService', () => {
  let service: InventoryService;
  let roomTypesRepo: ReturnType<typeof mockRepo>;
  let roomsRepo: ReturnType<typeof mockRepo>;
  let availabilityRepo: ReturnType<typeof mockRepo>;
  let ratePeriodRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    roomTypesRepo = mockRepo();
    roomsRepo = mockRepo();
    availabilityRepo = mockRepo();
    ratePeriodRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(RoomType), useValue: roomTypesRepo },
        { provide: getRepositoryToken(RoomAmenity), useValue: mockRepo() },
        { provide: getRepositoryToken(Room), useValue: roomsRepo },
        { provide: getRepositoryToken(RoomAvailability), useValue: availabilityRepo },
        { provide: getRepositoryToken(RatePeriod), useValue: ratePeriodRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  describe('createRoomType', () => {
    it('should create a room type with amenities', async () => {
      const rt = { id: 'rt-1', name: 'Deluxe', property_id: 'prop-1' };
      mockManager.save.mockResolvedValueOnce(rt);
      mockManager.save.mockResolvedValueOnce([]);
      mockManager.findOne.mockResolvedValue({ ...rt, amenities: [{ amenity: 'WiFi' }], rooms: [] });

      const result = await service.createRoomType('prop-1', {
        name: 'Deluxe',
        base_price: 1000,
        max_occupancy: 2,
        amenities: [{ amenity: 'WiFi' }],
      });

      expect(result.name).toBe('Deluxe');
      expect(result.amenities).toHaveLength(1);
    });
  });

  describe('createRoom', () => {
    it('should create a room and populate 365 days of availability', async () => {
      mockManager.findOne.mockResolvedValue({ id: 'rt-1', property_id: 'prop-1' });
      mockManager.save.mockResolvedValue({ id: 'room-1', name: 'Room 101' });
      mockManager.query.mockResolvedValue(undefined);

      const result = await service.createRoom('prop-1', {
        room_type_id: 'rt-1',
        name: 'Room 101',
      });

      expect(result.name).toBe('Room 101');
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('generate_series'),
        expect.any(Array),
      );
    });

    it('should reject room for wrong property room type', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.createRoom('prop-1', { room_type_id: 'rt-wrong', name: 'Room 1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('blockDates', () => {
    it('should block available dates', async () => {
      roomsRepo.findOne.mockResolvedValue({ id: 'room-1', property_id: 'prop-1' });

      const result = await service.blockDates('prop-1', {
        room_id: 'room-1',
        start_date: '2026-07-01',
        end_date: '2026-07-03',
        reason: 'maintenance',
      });

      expect(result.blocked).toBe(3);
    });

    it('should reject when end_date < start_date', async () => {
      roomsRepo.findOne.mockResolvedValue({ id: 'room-1', property_id: 'prop-1' });

      await expect(
        service.blockDates('prop-1', {
          room_id: 'room-1',
          start_date: '2026-07-05',
          end_date: '2026-07-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when room does not belong to property', async () => {
      roomsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.blockDates('prop-1', {
          room_id: 'room-wrong',
          start_date: '2026-07-01',
          end_date: '2026-07-03',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unblockDates', () => {
    it('should unblock blocked dates', async () => {
      roomsRepo.findOne.mockResolvedValue({ id: 'room-1', property_id: 'prop-1' });

      const result = await service.unblockDates('prop-1', {
        room_id: 'room-1',
        start_date: '2026-07-01',
        end_date: '2026-07-03',
      });

      expect(result.unblocked).toBe(3);
    });
  });

  describe('createRatePeriod', () => {
    it('should create a rate period with price override', async () => {
      ratePeriodRepo.save.mockResolvedValue({
        id: 'rp-1',
        start_date: '2026-12-15',
        end_date: '2026-12-31',
        price_override: 1500,
      });

      const result = await service.createRatePeriod('prop-1', {
        room_type_id: 'rt-1',
        start_date: '2026-12-15',
        end_date: '2026-12-31',
        name: 'Christmas',
        price_override: 1500,
      });

      expect(result.price_override).toBe(1500);
    });

    it('should reject when neither price_override nor price_modifier set', async () => {
      await expect(
        service.createRatePeriod('prop-1', {
          room_type_id: 'rt-1',
          start_date: '2026-12-15',
          end_date: '2026-12-31',
          name: 'Empty',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when end_date < start_date', async () => {
      await expect(
        service.createRatePeriod('prop-1', {
          room_type_id: 'rt-1',
          start_date: '2026-12-31',
          end_date: '2026-12-15',
          name: 'Invalid',
          price_override: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEffectivePrice', () => {
    let mockGetOne: jest.Mock;

    beforeEach(() => {
      mockGetOne = jest.fn().mockResolvedValue(null);
      ratePeriodRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: mockGetOne,
      });
    });

    it('should return base price when no rate period exists', async () => {
      roomTypesRepo.findOne.mockResolvedValue({ id: 'rt-1', base_price: 800 });

      const result = await service.getEffectivePrice('rt-1', 'prop-1', '2026-06-15');
      expect(result).toBe(800);
    });

    it('should return overridden price when rate period applies', async () => {
      roomTypesRepo.findOne.mockResolvedValue({ id: 'rt-1', base_price: 800 });
      mockGetOne.mockResolvedValue({ price_override: 1200, price_modifier: null });

      const result = await service.getEffectivePrice('rt-1', 'prop-1', '2026-12-25');
      expect(result).toBe(1200);
    });

    it('should apply percentage modifier when set', async () => {
      roomTypesRepo.findOne.mockResolvedValue({ id: 'rt-1', base_price: 1000 });
      mockGetOne.mockResolvedValue({ price_override: null, price_modifier: 20 });

      const result = await service.getEffectivePrice('rt-1', 'prop-1', '2026-12-25');
      expect(result).toBe(1200);
    });

    it('should throw when room type not found', async () => {
      roomTypesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getEffectivePrice('rt-nope', 'prop-1', '2026-06-15'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRatePeriod', () => {
    it('should delete an existing rate period', async () => {
      ratePeriodRepo.findOne.mockResolvedValue({ id: 'rp-1' });

      await service.deleteRatePeriod('rp-1');
      expect(ratePeriodRepo.remove).toHaveBeenCalled();
    });

    it('should throw when rate period not found', async () => {
      ratePeriodRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteRatePeriod('rp-nope')).rejects.toThrow(NotFoundException);
    });
  });
});
