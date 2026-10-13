import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * DTOs for the unauthenticated guest-portal routes. These bodies were
 * previously typed as inline object literals, which the global ValidationPipe
 * silently skips (no whitelist, no type checks). Each public route now binds a
 * real class-validator DTO so the global `whitelist`/`forbidNonWhitelisted`
 * settings apply.
 */

export class BookingLookupDto {
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @IsEmail()
  email: string;
}

export class PublicPaymentInitiateDto {
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  paymentType: string;
}

export class GuestCancelBookingDto {
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  cancelGroup?: boolean;
}

export class GuestModifyBookingDto {
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @IsEmail()
  email: string;

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
}

export class TrackBookingProgressDto {
  @IsUUID()
  propertyId: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsInt()
  @Min(0)
  stepReached: number;

  @IsOptional()
  @IsNumber()
  estimatedTotal?: number;
}
