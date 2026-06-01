import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { LevyType } from '../entities/tourism-levy-settings.entity';

export class UpdateTourismLevySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(LevyType)
  levy_type?: LevyType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  levy_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  levy_percent?: number;

  @IsOptional()
  @IsString()
  levy_name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exempt_children_under?: number;

  @IsOptional()
  @IsBoolean()
  include_in_total?: boolean;
}

export class LevyReportQueryDto {
  startDate: string;
  endDate: string;
}
