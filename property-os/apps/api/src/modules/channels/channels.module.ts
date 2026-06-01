import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsService } from './channels.service';
import { ChannelsSyncService } from './channels-sync.service';
import { ChannelsEventListener } from './channels-event.listener';
import { ICalService } from './ical.service';
import { ChannelsController } from './channels.controller';
import { Channel } from './entities/channel.entity';
import { ChannelMapping } from './entities/channel-mapping.entity';
import { SyncLog } from './entities/sync-log.entity';
import { PropertiesModule } from '../properties/properties.module';
import { BookingsModule } from '../bookings/bookings.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ICalChannelProvider } from './providers/ical.provider';
import { BookingComProvider } from './providers/booking-com.provider';
import { AirbnbProvider } from './providers/airbnb.provider';
import { ChannelProviderRegistry } from './providers/channel-provider.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, ChannelMapping, SyncLog]),
    PropertiesModule,
    BookingsModule,
    InventoryModule,
  ],
  providers: [
    ChannelsService,
    ChannelsSyncService,
    ChannelsEventListener,
    ICalService,
    ICalChannelProvider,
    BookingComProvider,
    AirbnbProvider,
    ChannelProviderRegistry,
  ],
  controllers: [ChannelsController],
  exports: [ChannelsService, ICalService, ChannelProviderRegistry],
})
export class ChannelsModule {}
