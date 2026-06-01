import { IsBoolean, IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { AlertStatus } from '../entities/smart-alert.entity';

export class UpdateAlertDto {
  @IsEnum(AlertStatus)
  status: AlertStatus;
}

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(90)
  lowOccupancyThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  lowOccupancyLookaheadDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  noBookingsDays?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(80)
  highCancellationThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(80)
  revenueDropThreshold?: number;

  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;
}
