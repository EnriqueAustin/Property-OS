import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  email_booking_confirmation?: boolean;

  @IsOptional()
  @IsBoolean()
  email_cancellation?: boolean;

  @IsOptional()
  @IsBoolean()
  email_payment_received?: boolean;

  @IsOptional()
  @IsBoolean()
  email_owner_new_booking?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsapp_booking_confirmation?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsapp_owner_new_booking?: boolean;

  @IsOptional()
  @IsBoolean()
  email_pre_arrival?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  @Type(() => Number)
  pre_arrival_days_before?: number;

  @IsOptional()
  @IsBoolean()
  email_post_stay_review?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  @Type(() => Number)
  post_stay_days_after?: number;

  @IsOptional()
  @IsBoolean()
  whatsapp_check_in_info?: boolean;

  @IsOptional()
  @IsString()
  wifi_name?: string;

  @IsOptional()
  @IsString()
  wifi_password?: string;

  @IsOptional()
  @IsString()
  directions?: string;
}
