import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import { Channel, ChannelStatus } from './entities/channel.entity';
import { ChannelsService } from './channels.service';

@Injectable()
export class ChannelsSyncService {
  private readonly logger = new Logger(ChannelsSyncService.name);

  constructor(
    @InjectRepository(Channel)
    private channelsRepo: Repository<Channel>,
    private channelsService: ChannelsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncDueChannels() {
    const channels = await this.channelsRepo.find({
      where: {
        status: Not(ChannelStatus.DISCONNECTED),
        ical_import_url: Not('') as any,
      },
    });

    const now = Date.now();

    for (const channel of channels) {
      if (!channel.ical_import_url) continue;

      const intervalMs = (channel.sync_interval_minutes || 15) * 60 * 1000;
      const lastSync = channel.last_sync_at
        ? new Date(channel.last_sync_at).getTime()
        : 0;

      if (now - lastSync >= intervalMs) {
        try {
          this.logger.log(`Syncing channel ${channel.name} (${channel.id})`);
          await this.channelsService.syncICalImport(channel.id);
        } catch (err: any) {
          this.logger.error(
            `Sync failed for channel ${channel.id}: ${err.message}`,
          );
        }
      }
    }
  }
}
