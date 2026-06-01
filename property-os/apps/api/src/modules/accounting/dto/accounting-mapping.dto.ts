import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { AccountingEntityType } from '../entities/accounting-mapping.entity';

export class CreateAccountingMappingDto {
  @IsUUID()
  connectionId: string;

  @IsEnum(AccountingEntityType)
  entityType: AccountingEntityType;

  @IsUUID()
  internalId: string;

  @IsString()
  @IsNotEmpty()
  providerRef: string;
}
