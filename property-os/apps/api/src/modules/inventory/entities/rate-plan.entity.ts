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
import { RoomType } from './room-type.entity';

export enum CancellationPolicy {
  FLEXIBLE = 'flexible',
  MODERATE = 'moderate',
  STRICT = 'strict',
  NON_REFUNDABLE = 'non_refundable',
}

@Entity('rate_plans')
@Index('idx_rate_plans_property', ['property_id'])
@Index('idx_rate_plans_room_type', ['room_type_id'])
export class RatePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  room_type_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  price_modifier_percent: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: CancellationPolicy.FLEXIBLE,
  })
  cancellation_policy: CancellationPolicy;

  @Column({ type: 'int', default: 0 })
  free_cancellation_days: number;

  @Column({ type: 'boolean', default: false })
  includes_breakfast: boolean;

  @Column({ type: 'boolean', default: false })
  includes_parking: boolean;

  @Column({ type: 'boolean', default: false })
  includes_wifi: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  inclusions: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => RoomType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_type_id' })
  room_type: RoomType;
}
