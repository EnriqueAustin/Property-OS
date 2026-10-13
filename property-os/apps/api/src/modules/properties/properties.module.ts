import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PdfReportService } from './pdf-report.service';
import { UploadController } from './upload.controller';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { Property } from './entities/property.entity';
import { PropertyUser } from './entities/property-user.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { Room } from '../inventory/entities/room.entity';
import { User } from '../users/entities/user.entity';
import { EmailProvider } from '../notifications/providers/email.provider';
@Module({
  imports: [TypeOrmModule.forFeature([Property, PropertyUser, RoomType, Room, User])],
  providers: [PropertiesService, ReportsService, PdfReportService, StaffService, EmailProvider],
  controllers: [PropertiesController, ReportsController, UploadController, StaffController],
  exports: [PropertiesService, TypeOrmModule],
})
export class PropertiesModule {}
