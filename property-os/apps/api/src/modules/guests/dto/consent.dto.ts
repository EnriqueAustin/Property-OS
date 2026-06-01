import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { ConsentType } from '../entities/guest-consent.entity';

export class GrantConsentDto {
  @IsString()
  referenceNumber: string;

  @IsEmail()
  email: string;

  @IsEnum(ConsentType, { each: true })
  consentTypes: ConsentType[];

  @IsOptional()
  @IsString()
  idNumber?: string;
}

export class WithdrawConsentDto {
  @IsString()
  referenceNumber: string;

  @IsEmail()
  email: string;

  @IsEnum(ConsentType, { each: true })
  consentTypes: ConsentType[];
}

export class ErasureRequestDto {
  @IsString()
  referenceNumber: string;

  @IsEmail()
  email: string;
}

export class UpdateRetentionSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(30)
  guestDataRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(365)
  bookingDataRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(365)
  paymentDataRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  autoAnonymizeExpired?: boolean;

  @IsOptional()
  @IsString()
  privacyPolicyUrl?: string;

  @IsOptional()
  @IsEmail()
  dataOfficerEmail?: string;
}
