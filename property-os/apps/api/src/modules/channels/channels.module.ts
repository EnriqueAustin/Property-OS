import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsService } from './channels.service';
import { ChannelsSyncService } from './channels-sync.service';
import { ICalService } from './ical.service';
import { ChannelsController } from './channels.controller';
import { Channel } from './entities/channel.entity';
import { ChannelMapping } from './entities/channel-mapping.entity';
import { SyncLog } from './entities/sync-log.entity';
import { PropertiesModule } from '../properties/properties.module';
import { BookingsModule } from '../bookings/bookings.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, ChannelMapping, SyncLog]),
    PropertiesModule,
    BookingsModule,
    InventoryModule,
  ],
  providers: [ChannelsService, ChannelsSyncService, ICalService],
  controllers: [ChannelsController],
  exports: [ChannelsService, ICalService],
})
export class ChannelsModule {}
