import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { RefundReason } from '../entities/refund.entity';

export class CreateRefundDto {
  @IsUUID()
  bookingId: string;

  @IsUUID()
  originalPaymentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(RefundReason)
  reason: RefundReason;

  @IsOptional()
  @IsString()
  reasonDetails?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveRefundDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectRefundDto {
  @IsString()
  reason: string;
}
