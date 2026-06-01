import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';
import { TaskStatus, TaskType, TaskPriority } from '../entities/housekeeping-task.entity';

export class CreateHousekeepingTaskDto {
  @IsEnum(TaskType)
  task_type: TaskType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;

  @IsOptional()
  @IsUUID()
  booking_id?: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_cost?: number;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  vendor_phone?: string;

  @IsOptional()
  @IsBoolean()
  blocks_room?: boolean;
}

export class UpdateHousekeepingTaskDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actual_cost?: number;

  @IsOptional()
  @IsString()
  resolution_notes?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  vendor_phone?: string;

  @IsOptional()
  @IsBoolean()
  blocks_room?: boolean;
}

export class TaskQueryDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;
}
