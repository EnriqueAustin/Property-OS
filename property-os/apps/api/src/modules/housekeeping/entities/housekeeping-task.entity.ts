import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../inventory/entities/room.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export enum TaskType {
  CHECKOUT_CLEAN = 'checkout_clean',
  CHECKIN_PREP = 'checkin_prep',
  MAINTENANCE = 'maintenance',
  INSPECTION = 'inspection',
  CUSTOM = 'custom',
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('housekeeping_tasks')
@Index('idx_hk_tasks_property_date', ['property_id', 'due_date'])
@Index('idx_hk_tasks_room', ['room_id'])
@Index('idx_hk_tasks_status', ['status'])
export class HousekeepingTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid', nullable: true })
  room_id: string;

  @Column({ type: 'uuid', nullable: true })
  booking_id: string;

  @Column({ type: 'enum', enum: TaskType })
  task_type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.NORMAL })
  priority: TaskPriority;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'date' })
  due_date: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assigned_to: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimated_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actual_cost: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendor: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vendor_phone: string;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string;

  @Column({ type: 'boolean', default: false })
  blocks_room: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
