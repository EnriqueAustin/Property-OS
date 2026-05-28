import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentProvider, PaymentType } from '../entities/payment.entity';

export class InitiatePayfastPaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

export class InitiateEftPaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

export class ConfirmEftPaymentDto {
  @IsOptional()
  @IsString()
  eftReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordManualPaymentDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @IsOptional()
  @IsString()
  notes?: string;
}
