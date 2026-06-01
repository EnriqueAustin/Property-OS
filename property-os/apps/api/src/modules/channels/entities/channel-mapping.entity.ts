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
import { Channel } from './channel.entity';
import { RoomType } from '../../inventory/entities/room-type.entity';

@Entity('channel_mappings')
@Unique('uniq_channel_room_type', ['channel_id', 'room_type_id'])
@Index('idx_mapping_channel', ['channel_id'])
@Index('idx_mapping_room_type', ['room_type_id'])
export class ChannelMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'uuid' })
  room_type_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_listing_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_room_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  rate_override: number;

  @Column({ type: 'boolean', default: true })
  sync_availability: boolean;

  @Column({ type: 'boolean', default: true })
  sync_rates: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Channel, (c) => c.mappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @ManyToOne(() => RoomType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_type_id' })
  room_type: RoomType;
}
