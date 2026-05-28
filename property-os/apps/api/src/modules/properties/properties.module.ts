import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { UploadController } from './upload.controller';
import { Property } from './entities/property.entity';
import { PropertyUser } from './entities/property-user.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { PropertyGuard } from '../../common/guards/property.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Property, PropertyUser, RoomType])],
  providers: [PropertiesService, ReportsService, PropertyGuard],
  controllers: [PropertiesController, ReportsController, UploadController],
  exports: [PropertiesService, TypeOrmModule],
})
export class PropertiesModule {}
