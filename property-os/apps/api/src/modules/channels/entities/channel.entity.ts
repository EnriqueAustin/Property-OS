import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  Unique,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { ChannelMapping } from './channel-mapping.entity';

export enum ChannelType {
  BOOKING_COM = 'booking_com',
  AIRBNB = 'airbnb',
  EXPEDIA = 'expedia',
  ICAL = 'ical',
}

export enum ChannelStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

@Entity('channels')
@Unique('uniq_property_channel', ['property_id', 'type', 'name'])
@Index('idx_channels_property', ['property_id'])
@Index('idx_channels_type', ['type'])
@Index('idx_channels_status', ['status'])
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 30 })
  type: ChannelType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: ChannelStatus.ACTIVE })
  status: ChannelStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  ical_import_url: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  ical_export_token: string;

  @Column({ type: 'jsonb', default: '{}' })
  credentials: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commission_percent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rate_markup_percent: number;

  @Column({ type: 'int', default: 15 })
  sync_interval_minutes: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_sync_at: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  last_sync_error: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @OneToMany(() => ChannelMapping, (m) => m.channel, { cascade: true })
  mappings: ChannelMapping[];
}
