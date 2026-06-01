import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GuestDto } from './create-booking.dto';

export class RoomSelectionDto {
  @IsUUID()
  roomTypeId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;
}

export class PublicBookingDto {
  @IsString()
  propertySlug: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomSelectionDto)
  rooms?: RoomSelectionDto[];

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ValidateNested()
  @Type(() => GuestDto)
  guest: GuestDto;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class OnlineCheckInDto {
  @IsString()
  referenceNumber: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  expectedArrivalTime?: string;

  @IsOptional()
  @IsString()
  vehicleRegistration?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  numVehicles?: number;

  @IsOptional()
  @IsString()
  dietaryRequirements?: string;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;
}

export class PublicAvailabilityQueryDto {
  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}
