import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { ChannelStatus } from '../entities/channel.entity';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ChannelStatus)
  status?: ChannelStatus;

  @IsOptional()
  @IsUrl()
  icalImportUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(100)
  rateMarkupPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  syncIntervalMinutes?: number;
}
