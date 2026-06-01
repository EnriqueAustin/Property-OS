import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class AmenityDto {
  @IsString()
  @Length(1, 100)
  amenity: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;
}

export class CreateRoomTypeDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  base_price: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_occupancy?: number;

  @IsOptional()
  @IsString()
  bed_type?: string;

  @IsOptional()
  @IsNumber()
  size_sqm?: number;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  base_occupancy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  single_occupancy_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extra_person_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  child_rate?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AmenityDto)
  amenities?: AmenityDto[];
}

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {}
