import {
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

export class PublicBookingDto {
  @IsString()
  propertySlug: string;

  @IsUUID()
  roomTypeId: string;

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
