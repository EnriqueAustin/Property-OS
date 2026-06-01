import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { FolioCategory } from '../entities/folio-item.entity';

export class AddFolioItemDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(FolioCategory)
  category: FolioCategory;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
