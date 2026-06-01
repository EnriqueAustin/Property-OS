import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { RoomType } from './room-type.entity';

@Entity('rate_periods')
@Check('chk_rate_dates', '"end_date" >= "start_date"')
@Index('idx_rate_periods_property', ['property_id', 'start_date', 'end_date'])
export class RatePeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid', nullable: true })
  room_type_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_override: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  price_modifier: number;

  @Column({ type: 'int', nullable: true })
  min_stay: number;

  @Column({ type: 'int', nullable: true })
  max_stay: number;

  @Column({ type: 'boolean', default: false })
  closed_to_arrival: boolean;

  @Column({ type: 'boolean', default: false })
  closed_to_departure: boolean;

  @Column({ type: 'boolean', default: false })
  stop_sell: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => RoomType, { nullable: true })
  @JoinColumn({ name: 'room_type_id' })
  room_type: RoomType;
}
