import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromosService } from './promos.service';
import { PromosController } from './promos.controller';
import { PromoCode } from './entities/promo-code.entity';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromoCode]),
    PropertiesModule,
  ],
  providers: [PromosService],
  controllers: [PromosController],
  exports: [PromosService],
})
export class PromosModule {}
