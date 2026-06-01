import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsString()
  payfastMerchantId?: string;

  @IsOptional()
  @IsString()
  payfastMerchantKey?: string;

  @IsOptional()
  @IsString()
  payfastPassphrase?: string;

  @IsOptional()
  @IsBoolean()
  payfastSandbox?: boolean;

  @IsOptional()
  @IsBoolean()
  payfastEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  snapscanEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  eftEnabled?: boolean;

  @IsOptional()
  @IsString()
  eftBankName?: string;

  @IsOptional()
  @IsString()
  eftAccountHolder?: string;

  @IsOptional()
  @IsString()
  eftAccountNumber?: string;

  @IsOptional()
  @IsString()
  eftBranchCode?: string;

  @IsOptional()
  @IsString()
  eftAccountType?: string;
}
