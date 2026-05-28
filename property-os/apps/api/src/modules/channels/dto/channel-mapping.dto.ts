import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateChannelMappingDto {
  @IsUUID()
  roomTypeId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalListingId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalRoomId?: string;

  @IsOptional()
  @IsNumber()
  rateOverride?: number;

  @IsOptional()
  @IsBoolean()
  syncAvailability?: boolean;

  @IsOptional()
  @IsBoolean()
  syncRates?: boolean;
}

export class UpdateChannelMappingDto {
  @IsOptional()
  @IsString()
  externalListingId?: string;

  @IsOptional()
  @IsString()
  externalRoomId?: string;

  @IsOptional()
  @IsNumber()
  rateOverride?: number;

  @IsOptional()
  @IsBoolean()
  syncAvailability?: boolean;

  @IsOptional()
  @IsBoolean()
  syncRates?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
