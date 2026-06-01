import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingRule } from './entities/pricing-rule.entity';
import { PricingService } from './pricing.service';
import { PricingController, PricingPortfolioController } from './pricing.controller';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule]), PropertiesModule],
  controllers: [PricingController, PricingPortfolioController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
