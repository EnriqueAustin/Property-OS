import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Channel, ChannelStatus } from './entities/channel.entity';
import { SyncLog, SyncDirection, SyncStatus } from './entities/sync-log.entity';
import { ChannelsService } from './channels.service';
import { ChannelProviderRegistry } from './providers/channel-provider.registry';
import { RoomAvailability, AvailabilityStatus } from '../inventory/entities/room-availability.entity';

@Injectable()
export class ChannelsSyncService {
  private readonly logger = new Logger(ChannelsSyncService.name);

  constructor(
    @InjectRepository(Channel)
    private channelsRepo: Repository<Channel>,
    @InjectRepository(SyncLog)
    private syncLogsRepo: Repository<SyncLog>,
    @InjectRepository(RoomAvailability)
    private availabilityRepo: Repository<RoomAvailability>,
    private channelsService: ChannelsService,
    private providerRegistry: ChannelProviderRegistry,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncDueChannels() {
    const channels = await this.channelsRepo.find({
      where: {
        status: Not(ChannelStatus.DISCONNECTED),
      },
      relations: ['mappings'],
    });

    const now = Date.now();

    for (const channel of channels) {
      const intervalMs = (channel.sync_interval_minutes || 15) * 60 * 1000;
      const lastSync = channel.last_sync_at
        ? new Date(channel.last_sync_at).getTime()
        : 0;

      if (now - lastSync < intervalMs) continue;

      // Import: pull iCal feeds
      if (channel.ical_import_url) {
        try {
          this.logger.log(`Importing from channel ${channel.name} (${channel.id})`);
          await this.channelsService.syncICalImport(channel.id);
        } catch (err: any) {
          this.logger.error(
            `Import sync failed for channel ${channel.id}: ${err.message}`,
          );
        }
      }

      // Export: push availability via provider
      await this.pushExportForChannel(channel);
    }
  }

  private async pushExportForChannel(channel: Channel) {
    const provider = this.providerRegistry.get(channel.type);
    if (!provider) return;

    const activeMappings = channel.mappings?.filter(
      (m) => m.is_active && m.sync_availability,
    );
    if (!activeMappings || activeMappings.length === 0) return;

    const start = Date.now();
    const log = this.syncLogsRepo.create({
      channel_id: channel.id,
      direction: SyncDirection.EXPORT,
      status: SyncStatus.SUCCESS,
    });

    try {
      const today = new Date().toISOString().split('T')[0]!;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);
      const future = futureDate.toISOString().split('T')[0]!;

      let totalUpdates = 0;

      for (const mapping of activeMappings) {
        const booked = await this.availabilityRepo
          .createQueryBuilder('a')
          .innerJoin('a.room', 'r')
          .select('a.date', 'date')
          .addSelect('COUNT(*)', 'booked_count')
          .where('r.room_type_id = :rtId', { rtId: mapping.room_type_id })
          .andWhere('a.date >= :today', { today })
          .andWhere('a.date <= :future', { future })
          .andWhere('a.status != :available', {
            available: AvailabilityStatus.AVAILABLE,
          })
          .groupBy('a.date')
          .getRawMany();

        const bookedDates = new Set(booked.map((r: any) => r.date));
        const dates: { date: string; available: boolean }[] = [];
        const d = new Date(today);
        const end = new Date(future);
        while (d <= end) {
          const ds = d.toISOString().split('T')[0]!;
          dates.push({ date: ds, available: !bookedDates.has(ds) });
          d.setDate(d.getDate() + 1);
        }

        const result = await provider.pushAvailability(channel.credentials, [
          {
            roomTypeId: mapping.room_type_id,
            externalRoomId: mapping.external_room_id || mapping.external_listing_id || '',
            dates,
          },
        ]);
        totalUpdates += result.updatedCount;
      }

      log.availability_updates = totalUpdates;
      log.details = { trigger: 'scheduled', mappings: activeMappings.length };
    } catch (err: any) {
      log.status = SyncStatus.FAILED;
      log.error_message = err.message;
      this.logger.error(
        `Export sync failed for channel ${channel.id}: ${err.message}`,
      );
    }

    log.duration_ms = Date.now() - start;
    await this.syncLogsRepo.save(log);
  }
}
