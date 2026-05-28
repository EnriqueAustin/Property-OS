import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { ChannelType } from '../entities/channel.entity';

export class CreateChannelDto {
  propertyId: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsString()
  @IsNotEmpty()
  name: string;

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
