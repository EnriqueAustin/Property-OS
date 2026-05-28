import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ChannelsService } from './channels.service';
import { ICalService } from './ical.service';
import { Channel, ChannelType, ChannelStatus } from './entities/channel.entity';
import { ChannelMapping } from './entities/channel-mapping.entity';
import { SyncLog } from './entities/sync-log.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Room } from '../inventory/entities/room.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { RoomAvailability } from '../inventory/entities/room-availability.entity';
import { Guest } from '../bookings/entities/guest.entity';

const mockChannel = {
  id: 'ch-1',
  property_id: 'prop-1',
  type: ChannelType.AIRBNB,
  name: 'Airbnb Listing',
  status: ChannelStatus.ACTIVE,
  ical_import_url: 'https://airbnb.com/ical/abc',
  ical_export_token: 'export-token-123',
  commission_percent: 15,
  rate_markup_percent: 10,
  sync_interval_minutes: 15,
  mappings: [],
};

const mockChannelsRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((dto) => dto),
  save: jest.fn((entity) => Promise.resolve({ id: 'ch-new', ...entity })),
  remove: jest.fn(),
};

const mockMappingsRepo = {
  findOne: jest.fn(),
  create: jest.fn((dto) => dto),
  save: jest.fn((entity) => Promise.resolve({ id: 'map-1', ...entity })),
  remove: jest.fn(),
};

const mockSyncLogsRepo = {
  find: jest.fn(),
  create: jest.fn((dto) => dto),
  save: jest.fn((entity) => Promise.resolve({ id: 'sync-1', ...entity })),
};

const mockBookingsRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockRoomsRepo = { find: jest.fn() };
const mockRoomTypesRepo = { find: jest.fn(), findOne: jest.fn() };
const mockAvailabilityRepo = { createQueryBuilder: jest.fn() };
const mockGuestsRepo = {};
const mockDataSource = { transaction: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };
const mockICalService = {
  parseICalFeed: jest.fn(),
  generateICalFeed: jest.fn(),
};

describe('ChannelsService', () => {
  let service: ChannelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: getRepositoryToken(Channel), useValue: mockChannelsRepo },
        { provide: getRepositoryToken(ChannelMapping), useValue: mockMappingsRepo },
        { provide: getRepositoryToken(SyncLog), useValue: mockSyncLogsRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingsRepo },
        { provide: getRepositoryToken(Room), useValue: mockRoomsRepo },
        { provide: getRepositoryToken(RoomType), useValue: mockRoomTypesRepo },
        { provide: getRepositoryToken(RoomAvailability), useValue: mockAvailabilityRepo },
        { provide: getRepositoryToken(Guest), useValue: mockGuestsRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ICalService, useValue: mockICalService },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    jest.clearAllMocks();
  });

  describe('createChannel', () => {
    it('should create a new channel', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(null);

      const result = await service.createChannel({
        propertyId: 'prop-1',
        type: ChannelType.AIRBNB,
        name: 'My Airbnb',
      });

      expect(result.property_id).toBe('prop-1');
      expect(result.type).toBe('airbnb');
      expect(result.ical_export_token).toBeDefined();
    });

    it('should throw ConflictException for duplicate channel', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(mockChannel);

      await expect(
        service.createChannel({
          propertyId: 'prop-1',
          type: ChannelType.AIRBNB,
          name: 'Airbnb Listing',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listChannels', () => {
    it('should return channels for a property', async () => {
      mockChannelsRepo.find.mockResolvedValue([mockChannel]);

      const result = await service.listChannels('prop-1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('airbnb');
    });
  });

  describe('getChannel', () => {
    it('should return a channel by id', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(mockChannel);

      const result = await service.getChannel('ch-1');
      expect(result.name).toBe('Airbnb Listing');
    });

    it('should throw NotFoundException for unknown channel', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(null);

      await expect(service.getChannel('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateChannel', () => {
    it('should update channel fields', async () => {
      mockChannelsRepo.findOne.mockResolvedValue({ ...mockChannel });
      mockChannelsRepo.save.mockImplementation((ch) => Promise.resolve(ch));

      const result = await service.updateChannel('ch-1', {
        name: 'Updated Airbnb',
        commissionPercent: 12,
      });

      expect(result.name).toBe('Updated Airbnb');
      expect(result.commission_percent).toBe(12);
    });
  });

  describe('deleteChannel', () => {
    it('should remove the channel', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(mockChannel);

      await service.deleteChannel('ch-1');

      expect(mockChannelsRepo.remove).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('addMapping', () => {
    it('should create a mapping', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(mockChannel);
      mockMappingsRepo.findOne.mockResolvedValue(null);

      const result = await service.addMapping('ch-1', {
        roomTypeId: 'rt-1',
        syncAvailability: true,
        syncRates: true,
      });

      expect(result.channel_id).toBe('ch-1');
      expect(result.room_type_id).toBe('rt-1');
    });

    it('should throw ConflictException for duplicate mapping', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(mockChannel);
      mockMappingsRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.addMapping('ch-1', { roomTypeId: 'rt-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMapping', () => {
    it('should remove a mapping', async () => {
      const mapping = { id: 'map-1' };
      mockMappingsRepo.findOne.mockResolvedValue(mapping);

      await service.removeMapping('map-1');
      expect(mockMappingsRepo.remove).toHaveBeenCalledWith(mapping);
    });

    it('should throw NotFoundException for unknown mapping', async () => {
      mockMappingsRepo.findOne.mockResolvedValue(null);

      await expect(service.removeMapping('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSyncLogs', () => {
    it('should return sync logs', async () => {
      mockSyncLogsRepo.find.mockResolvedValue([{ id: 'sync-1', status: 'success' }]);

      const result = await service.getSyncLogs('ch-1', 20);

      expect(result).toHaveLength(1);
      expect(mockSyncLogsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'ch-1' } }),
      );
    });
  });

  describe('syncICalImport', () => {
    it('should throw NotFoundException for unknown channel', async () => {
      mockChannelsRepo.findOne.mockResolvedValue(null);

      await expect(service.syncICalImport('unknown')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no import URL', async () => {
      mockChannelsRepo.findOne.mockResolvedValue({
        ...mockChannel,
        ical_import_url: null,
      });

      await expect(service.syncICalImport('ch-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRateParity', () => {
    it('should return rate parity data', async () => {
      mockChannelsRepo.find.mockResolvedValue([
        {
          ...mockChannel,
          mappings: [
            {
              room_type_id: 'rt-1',
              is_active: true,
              rate_override: null,
            },
          ],
        },
      ]);
      mockRoomTypesRepo.find.mockResolvedValue([
        { id: 'rt-1', name: 'Deluxe', base_price: 2200 },
      ]);

      const result = await service.getRateParity('prop-1');

      expect(result).toHaveLength(1);
      expect(result[0].roomType.name).toBe('Deluxe');
      expect(result[0].channels).toHaveLength(1);
      expect(result[0].channels[0].effectiveRate).toBe(2420); // 2200 * 1.10
    });
  });

  describe('getRevenueByChannel', () => {
    it('should return revenue grouped by source', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { source: 'direct', bookings: '10', revenue: '50000', avgRate: '1500' },
        ]),
      };
      mockBookingsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getRevenueByChannel('prop-1', '2026-01-01', '2026-06-30');

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('direct');
    });
  });
});
