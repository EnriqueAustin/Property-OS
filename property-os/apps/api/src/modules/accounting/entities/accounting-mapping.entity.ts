import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AccountingConnection } from './accounting-connection.entity';

export enum AccountingEntityType {
  INVOICE = 'invoice',
  CONTACT = 'contact',
  PAYMENT = 'payment',
  CREDIT_NOTE = 'credit_note',
}

export enum AccountingSyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed',
}

@Entity('accounting_mappings')
@Unique('uq_accounting_mapping', ['connection_id', 'entity_type', 'internal_id'])
@Index('idx_accounting_mapping_connection', ['connection_id'])
@Index('idx_accounting_mapping_internal', ['entity_type', 'internal_id'])
@Index('idx_accounting_mapping_provider', ['provider_ref'])
export class AccountingMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  connection_id: string;

  @Column({ type: 'varchar', length: 20 })
  entity_type: AccountingEntityType;

  @Column({ type: 'uuid' })
  internal_id: string;

  @Column({ type: 'varchar', length: 255 })
  provider_ref: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AccountingSyncStatus.SYNCED,
  })
  sync_status: AccountingSyncStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_synced_at: Date;

  @Column({ type: 'text', nullable: true })
  last_error: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => AccountingConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection: AccountingConnection;
}
