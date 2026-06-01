import { IsOptional, IsEnum } from 'class-validator';
import { AccountingEntityType } from '../entities/accounting-mapping.entity';

export class ManualSyncDto {
  @IsOptional()
  @IsEnum(AccountingEntityType)
  entityType?: AccountingEntityType;
}
