import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBookingSettingsDto {
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
