import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';

export enum LevyType {
  PER_NIGHT = 'per_night',
  PER_GUEST_PER_NIGHT = 'per_guest_per_night',
  PERCENTAGE = 'percentage',
}

@Entity('tourism_levy_settings')
export class TourismLevySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  property_id: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 20, default: LevyType.PER_NIGHT })
  levy_type: LevyType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  levy_amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  levy_percent: number;

  @Column({ type: 'varchar', length: 100, default: 'Tourism Levy' })
  levy_name: string;

  @Column({ type: 'int', nullable: true })
  exempt_children_under: number;

  @Column({ type: 'boolean', default: true })
  include_in_total: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
