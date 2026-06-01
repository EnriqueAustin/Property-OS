import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { PricingRuleType } from '../entities/pricing-rule.entity';

export class CreatePricingRuleDto {
  @IsString()
  name: string;

  @IsEnum(PricingRuleType)
  rule_type: PricingRuleType;

  @IsNumber()
  @Min(-100)
  @Max(500)
  modifier_percent: number;

  @IsOptional()
  @IsUUID()
  room_type_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  days_before_checkin?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_nights?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  occupancy_threshold_percent?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class BulkCreatePricingRuleDto {
  @IsString()
  name: string;

  @IsEnum(PricingRuleType)
  rule_type: PricingRuleType;

  @IsNumber()
  @Min(-100)
  @Max(500)
  modifier_percent: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  days_before_checkin?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_nights?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  occupancy_threshold_percent?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  property_ids: string[];
}

export class UpdatePricingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PricingRuleType)
  rule_type?: PricingRuleType;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(500)
  modifier_percent?: number;

  @IsOptional()
  @IsUUID()
  room_type_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  days_before_checkin?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_nights?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  occupancy_threshold_percent?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
