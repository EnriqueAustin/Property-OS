import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FolioItem } from './entities/folio-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { FrontdeskService } from './frontdesk.service';
import { FrontdeskController } from './frontdesk.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FolioItem, Booking])],
  controllers: [FrontdeskController],
  providers: [FrontdeskService],
  exports: [FrontdeskService],
})
export class FrontdeskModule {}
