import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartAlert } from './entities/smart-alert.entity';
import { AlertSettings } from './entities/alert-settings.entity';
import { Property } from '../properties/entities/property.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmartAlert, AlertSettings, Property]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
