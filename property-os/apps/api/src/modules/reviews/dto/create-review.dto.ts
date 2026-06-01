import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  cleanlinessRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  comfortRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  locationRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmitPublicReviewDto extends CreateReviewDto {
  @IsString()
  referenceNumber: string;

  @IsString()
  email: string;
}

export class OwnerResponseDto {
  @IsString()
  response: string;
}

export class UpdateReviewStatusDto {
  @IsString()
  status: 'published' | 'hidden';
}
