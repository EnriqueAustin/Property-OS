import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Channel } from './channel.entity';

export enum SyncDirection {
  IMPORT = 'import',
  EXPORT = 'export',
}

export enum SyncStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

@Entity('sync_logs')
@Index('idx_sync_log_channel', ['channel_id'])
@Index('idx_sync_log_created', ['created_at'])
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'varchar', length: 10 })
  direction: SyncDirection;

  @Column({ type: 'varchar', length: 10 })
  status: SyncStatus;

  @Column({ type: 'int', default: 0 })
  bookings_imported: number;

  @Column({ type: 'int', default: 0 })
  bookings_exported: number;

  @Column({ type: 'int', default: 0 })
  availability_updates: number;

  @Column({ type: 'int', default: 0 })
  conflicts_found: number;

  @Column({ type: 'int', default: 0 })
  conflicts_resolved: number;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'jsonb', default: '{}' })
  details: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  duration_ms: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;
}
