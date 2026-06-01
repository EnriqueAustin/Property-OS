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

@Entity('data_retention_settings')
export class DataRetentionSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  property_id: string;

  @Column({ type: 'int', default: 365 })
  guest_data_retention_days: number;

  @Column({ type: 'int', default: 2555 })
  booking_data_retention_days: number;

  @Column({ type: 'int', default: 2555 })
  payment_data_retention_days: number;

  @Column({ type: 'boolean', default: true })
  auto_anonymize_expired: boolean;

  @Column({ type: 'text', nullable: true })
  privacy_policy_url: string;

  @Column({ type: 'text', nullable: true })
  data_officer_email: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
