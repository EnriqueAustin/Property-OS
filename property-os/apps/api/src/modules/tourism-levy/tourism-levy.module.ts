import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TourismLevySettings } from './entities/tourism-levy-settings.entity';
import { TourismLevyRecord } from './entities/tourism-levy-record.entity';
import { TourismLevyService } from './tourism-levy.service';
import { TourismLevyController } from './tourism-levy.controller';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TourismLevySettings, TourismLevyRecord]),
    PropertiesModule,
  ],
  controllers: [TourismLevyController],
  providers: [TourismLevyService],
  exports: [TourismLevyService],
})
export class TourismLevyModule {}
