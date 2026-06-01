import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePackageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  pricingType?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  availableAtBooking?: boolean;

  @IsOptional()
  @IsBoolean()
  availableAtCheckin?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  pricingType?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  availableAtBooking?: boolean;

  @IsOptional()
  @IsBoolean()
  availableAtCheckin?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class AddPackageToBookingDto {
  @IsUUID()
  packageId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
