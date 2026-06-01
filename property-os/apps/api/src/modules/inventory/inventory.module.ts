import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { RatePlansService } from './rate-plans.service';
import { RatePlansController } from './rate-plans.controller';
import { RoomType } from './entities/room-type.entity';
import { RoomAmenity } from './entities/room-amenity.entity';
import { Room } from './entities/room.entity';
import { RoomAvailability } from './entities/room-availability.entity';
import { RatePeriod } from './entities/rate-period.entity';
import { RatePlan } from './entities/rate-plan.entity';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoomType, RoomAmenity, Room, RoomAvailability, RatePeriod, RatePlan]),
    PropertiesModule,
  ],
  providers: [InventoryService, RatePlansService],
  controllers: [InventoryController, RatePlansController],
  exports: [InventoryService, RatePlansService, TypeOrmModule],
})
export class InventoryModule {}
