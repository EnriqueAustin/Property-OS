import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GuestDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

const SOURCES = [
  'direct',
  'booking_com',
  'airbnb',
  'expedia',
  'walk_in',
  'phone',
  'manual',
] as const;

export class CreateBookingDto {
  @IsUUID()
  propertyId: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roomIds?: string[];

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @ValidateNested()
  @Type(() => GuestDto)
  guest: GuestDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsIn(SOURCES as unknown as string[])
  source?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
