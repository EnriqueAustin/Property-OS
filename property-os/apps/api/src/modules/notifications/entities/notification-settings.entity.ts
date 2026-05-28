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

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  property_id: string;

  @Column({ type: 'boolean', default: true })
  email_booking_confirmation: boolean;

  @Column({ type: 'boolean', default: true })
  email_cancellation: boolean;

  @Column({ type: 'boolean', default: true })
  email_payment_received: boolean;

  @Column({ type: 'boolean', default: true })
  email_owner_new_booking: boolean;

  @Column({ type: 'boolean', default: false })
  whatsapp_booking_confirmation: boolean;

  @Column({ type: 'boolean', default: false })
  whatsapp_owner_new_booking: boolean;

  @Column({ type: 'boolean', default: true })
  email_pre_arrival: boolean;

  @Column({ type: 'int', default: 1 })
  pre_arrival_days_before: number;

  @Column({ type: 'boolean', default: true })
  email_post_stay_review: boolean;

  @Column({ type: 'int', default: 1 })
  post_stay_days_after: number;

  @Column({ type: 'boolean', default: false })
  whatsapp_check_in_info: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wifi_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wifi_password: string;

  @Column({ type: 'text', nullable: true })
  directions: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
