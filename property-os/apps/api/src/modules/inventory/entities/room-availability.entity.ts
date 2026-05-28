import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Room } from './room.entity';

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  BLOCKED = 'blocked',
  MAINTENANCE = 'maintenance',
}

@Entity('room_availability')
@Unique('uniq_room_date', ['room_id', 'date'])
@Index('idx_avail_room_date', ['room_id', 'date'])
@Index('idx_avail_date_status', ['date', 'status'])
@Index('idx_avail_property_date', ['room_id', 'date', 'status'])
@Index('idx_avail_booking', ['booking_id'])
export class RoomAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  room_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AvailabilityStatus.AVAILABLE,
  })
  status: AvailabilityStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_override: number | null;

  @Column({ type: 'uuid', nullable: true })
  booking_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  blocked_reason: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Room, (r) => r.availability, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
