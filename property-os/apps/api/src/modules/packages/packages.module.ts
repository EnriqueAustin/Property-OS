import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { Package } from './entities/package.entity';
import { BookingPackage } from './entities/booking-package.entity';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Package, BookingPackage]),
    BookingsModule,
  ],
  providers: [PackagesService],
  controllers: [PackagesController],
  exports: [PackagesService, TypeOrmModule],
})
export class PackagesModule {}
