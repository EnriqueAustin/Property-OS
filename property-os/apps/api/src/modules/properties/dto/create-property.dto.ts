import {
  IsString,
  IsOptional,
  IsIn,
  IsEmail,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';

export const PROPERTY_TYPES = ['guesthouse', 'hotel', 'lodge', 'bnb'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export class CreatePropertyDto {
  @IsString()
  @Length(2, 255)
  name: string;

  @IsIn(PROPERTY_TYPES as unknown as string[])
  property_type: PropertyType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'check_in_time must be HH:MM',
  })
  check_in_time?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'check_out_time must be HH:MM',
  })
  check_out_time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  min_stay_nights?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_stay_nights?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  advance_booking_days?: number;

  @IsOptional()
  @IsBoolean()
  deposit_required?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deposit_percentage?: number;

  @IsOptional()
  @IsString()
  cancellation_policy?: string;
}
