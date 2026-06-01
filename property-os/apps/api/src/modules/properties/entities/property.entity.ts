import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PropertyUser } from './property-user.entity';

@Entity('properties')
@Index('idx_properties_slug', ['slug'])
@Index('idx_properties_city', ['city'])
@Index('idx_properties_active', ['is_active', 'is_published'])
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  property_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line2: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postal_code: string;

  @Column({ type: 'varchar', length: 2, default: 'ZA' })
  country: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string;

  @Column({ type: 'varchar', length: 50, default: 'Africa/Johannesburg' })
  timezone: string;

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency: string;

  @Column({ type: 'time', default: '14:00' })
  check_in_time: string;

  @Column({ type: 'time', default: '10:00' })
  check_out_time: string;

  @Column({ type: 'int', default: 1 })
  min_stay_nights: number;

  @Column({ type: 'int', default: 30 })
  max_stay_nights: number;

  @Column({ type: 'int', default: 365 })
  advance_booking_days: number;

  @Column({ type: 'boolean', default: false })
  deposit_required: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  deposit_percentage: number;

  @Column({ type: 'text', nullable: true })
  cancellation_policy: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_published: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cover_image_url: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  google_analytics_id: string;

  @Column({ type: 'text', nullable: true })
  wifi_name: string;

  @Column({ type: 'text', nullable: true })
  wifi_password: string;

  @Column({ type: 'text', nullable: true })
  house_rules: string;

  @Column({ type: 'text', nullable: true })
  local_tips: string;

  @Column({ type: 'text', nullable: true })
  emergency_contact: string;

  @Column({ type: 'jsonb', default: '[]' })
  photos: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToMany(() => PropertyUser, (pu) => pu.property)
  property_users: PropertyUser[];
}
