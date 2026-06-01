import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelsSyncService } from './channels-sync.service';
import { Channel, ChannelStatus, ChannelType } from './entities/channel.entity';
import { SyncLog, SyncDirection, SyncStatus } from './entities/sync-log.entity';
import { RoomAvailability, AvailabilityStatus } from '../inventory/entities/room-availability.entity';
import { ChannelsService } from './channels.service';
import { ChannelProviderRegistry } from './providers/channel-provider.registry';

const mockChannelsRepo = {
  find: jest.fn(),
};

const mockSyncLogsRepo = {
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'sync-1', ...data })),
};

const mockAvailabilityRepo = {
  createQueryBuilder: jest.fn(() => ({
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  })),
};

const mockChannelsService = {
  syncICalImport: jest.fn().mockResolvedValue(undefined),
};

const mockProvider = {
  pushAvailability: jest.fn().mockResolvedValue({ updatedCount: 5 }),
};

const mockProviderRegistry = {
  get: jest.fn().mockReturnValue(mockProvider),
};

const mockChannel = (overrides: any = {}) => ({
  id: 'ch-1',
  property_id: 'prop-1',
  type: ChannelType.AIRBNB,
  name: 'Airbnb',
  status: ChannelStatus.ACTIVE,
  ical_import_url: 'https://airbnb.com/ical/abc',
  sync_interval_minutes: 15,
  last_sync_at: null,
  credentials: { api_key: 'test' },
  mappings: [
    {
      room_type_id: 'rt-1',
      is_active: true,
      sync_availability: true,
      external_room_id: 'ext-1',
      external_listing_id: null,
    },
  ],
  ...overrides,
});

describe('ChannelsSyncService', () => {
  let service: ChannelsSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsSyncService,
        { provide: getRepositoryToken(Channel), useValue: mockChannelsRepo },
        { provide: getRepositoryToken(SyncLog), useValue: mockSyncLogsRepo },
        { provide: getRepositoryToken(RoomAvailability), useValue: mockAvailabilityRepo },
        { provide: ChannelsService, useValue: mockChannelsService },
        { provide: ChannelProviderRegistry, useValue: mockProviderRegistry },
      ],
    }).compile();

    service = module.get<ChannelsSyncService>(ChannelsSyncService);
    jest.clearAllMocks();
  });

  describe('syncDueChannels', () => {
    it('should sync channels that are due', async () => {
      mockChannelsRepo.find.mockResolvedValue([mockChannel()]);

      await service.syncDueChannels();

      expect(mockChannelsService.syncICalImport).toHaveBeenCalledWith('ch-1');
      expect(mockProvider.pushAvailability).toHaveBeenCalled();
      expect(mockSyncLogsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: 'ch-1',
          direction: SyncDirection.EXPORT,
          status: SyncStatus.SUCCESS,
        }),
      );
    });

    it('should skip channels that synced recently', async () => {
      const recentSync = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
      mockChannelsRepo.find.mockResolvedValue([
        mockChannel({ last_sync_at: recentSync }),
      ]);

      await service.syncDueChannels();

      expect(mockChannelsService.syncICalImport).not.toHaveBeenCalled();
      expect(mockProvider.pushAvailability).not.toHaveBeenCalled();
    });

    it('should skip iCal import when no import URL', async () => {
      mockChannelsRepo.find.mockResolvedValue([
        mockChannel({ ical_import_url: null }),
      ]);

      await service.syncDueChannels();

      expect(mockChannelsService.syncICalImport).not.toHaveBeenCalled();
      // Export should still run
      expect(mockProvider.pushAvailability).toHaveBeenCalled();
    });

    it('should handle import errors gracefully and continue', async () => {
      mockChannelsRepo.find.mockResolvedValue([mockChannel()]);
      mockChannelsService.syncICalImport.mockRejectedValue(new Error('Network error'));

      await service.syncDueChannels();

      // Should still attempt export despite import failure
      expect(mockProvider.pushAvailability).toHaveBeenCalled();
    });

    it('should log failure when export throws', async () => {
      mockChannelsRepo.find.mockResolvedValue([
        mockChannel({ ical_import_url: null }),
      ]);
      mockProvider.pushAvailability.mockRejectedValue(new Error('API down'));

      await service.syncDueChannels();

      expect(mockSyncLogsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SyncStatus.FAILED,
          error_message: 'API down',
        }),
      );
    });

    it('should skip export when no provider exists for channel type', async () => {
      mockChannelsRepo.find.mockResolvedValue([
        mockChannel({ ical_import_url: null }),
      ]);
      mockProviderRegistry.get.mockReturnValue(null);

      await service.syncDueChannels();

      expect(mockProvider.pushAvailability).not.toHaveBeenCalled();
    });

    it('should skip export when no active mappings with sync_availability', async () => {
      mockChannelsRepo.find.mockResolvedValue([
        mockChannel({
          ical_import_url: null,
          mappings: [{ room_type_id: 'rt-1', is_active: true, sync_availability: false }],
        }),
      ]);

      await service.syncDueChannels();

      expect(mockProvider.pushAvailability).not.toHaveBeenCalled();
    });

    it('should do nothing when no channels exist', async () => {
      mockChannelsRepo.find.mockResolvedValue([]);

      await service.syncDueChannels();

      expect(mockChannelsService.syncICalImport).not.toHaveBeenCalled();
      expect(mockProvider.pushAvailability).not.toHaveBeenCalled();
    });
  });
});
