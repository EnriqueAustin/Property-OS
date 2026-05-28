import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRatePeriodDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  room_type_id?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_override?: number;

  @IsOptional()
  @IsNumber()
  price_modifier?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  min_stay?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateRatePeriodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  room_type_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_override?: number;

  @IsOptional()
  @IsNumber()
  price_modifier?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  min_stay?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
