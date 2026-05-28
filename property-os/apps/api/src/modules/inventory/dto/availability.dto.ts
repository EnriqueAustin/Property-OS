import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AvailabilityStatus } from '../entities/room-availability.entity';

export class AvailabilityQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}

export class BlockDatesDto {
  @IsUUID()
  room_id: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}

export class UnblockDatesDto {
  @IsUUID()
  room_id: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}

export class BulkAvailabilityUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  room_ids: string[];

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price_override?: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}
