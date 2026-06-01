import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AccountingProviderType } from '../entities/accounting-connection.entity';

export class ConnectAccountingDto {
  @IsEnum(AccountingProviderType)
  providerType: AccountingProviderType;
}

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class UpdateConnectionSettingsDto {
  @IsString()
  @IsOptional()
  defaultRevenueAccountCode?: string;

  @IsString()
  @IsOptional()
  defaultTaxType?: string;

  @IsOptional()
  autoSyncEnabled?: boolean;

  @IsOptional()
  syncInvoices?: boolean;

  @IsOptional()
  syncPayments?: boolean;

  @IsOptional()
  syncCreditNotes?: boolean;
}
