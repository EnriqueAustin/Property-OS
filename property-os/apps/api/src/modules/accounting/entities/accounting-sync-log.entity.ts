import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AccountingConnection } from './accounting-connection.entity';
import { AccountingEntityType } from './accounting-mapping.entity';

export enum SyncDirection {
  PUSH = 'push',
}

export enum SyncLogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('accounting_sync_logs')
@Index('idx_accounting_sync_log_connection', ['connection_id'])
@Index('idx_accounting_sync_log_created', ['created_at'])
export class AccountingSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  connection_id: string;

  @Column({ type: 'varchar', length: 10, default: SyncDirection.PUSH })
  direction: SyncDirection;

  @Column({ type: 'varchar', length: 20 })
  entity_type: AccountingEntityType;

  @Column({ type: 'uuid', nullable: true })
  internal_id: string;

  @Column({ type: 'varchar', length: 20 })
  status: SyncLogStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'int', nullable: true })
  duration_ms: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => AccountingConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection: AccountingConnection;
}
