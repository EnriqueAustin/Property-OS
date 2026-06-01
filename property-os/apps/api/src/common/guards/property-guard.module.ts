import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyUser } from '../../modules/properties/entities/property-user.entity';
import { PropertyGuard } from './property.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PropertyUser])],
  providers: [PropertyGuard],
  exports: [PropertyGuard, TypeOrmModule],
})
export class PropertyGuardModule {}
