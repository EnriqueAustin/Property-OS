import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BookingStatus } from '../entities/booking.entity';

export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}

const VALID_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'no_show',
] as const;

export class UpdateStatusDto {
  @IsIn(VALID_STATUSES as unknown as string[])
  status: BookingStatus;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
