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
import { RoomType } from '../../inventory/entities/room-type.entity';

export enum PricingRuleType {
  WEEKEND = 'weekend',
  WEEKDAY = 'weekday',
  LAST_MINUTE = 'last_minute',
  EARLY_BIRD = 'early_bird',
  LENGTH_OF_STAY = 'length_of_stay',
  OCCUPANCY = 'occupancy',
}

@Entity('pricing_rules')
@Index('idx_pricing_rules_property', ['property_id'])
export class PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid', nullable: true })
  room_type_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: PricingRuleType })
  rule_type: PricingRuleType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  modifier_percent: number;

  @Column({ type: 'int', nullable: true })
  days_before_checkin: number;

  @Column({ type: 'int', nullable: true })
  min_nights: number;

  @Column({ type: 'int', nullable: true })
  occupancy_threshold_percent: number;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => RoomType, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_type_id' })
  room_type: RoomType;
}
