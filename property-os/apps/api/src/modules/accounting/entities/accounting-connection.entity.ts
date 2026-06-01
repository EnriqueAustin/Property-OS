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
import { Property } from '../../properties/entities/property.entity';

export enum AccountingProviderType {
  XERO = 'xero',
  SAGE = 'sage',
  QUICKBOOKS = 'quickbooks',
  ZOHO = 'zoho',
  FRESHBOOKS = 'freshbooks',
}

export enum AccountingConnectionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

@Entity('accounting_connections')
@Unique('uq_accounting_conn_property_provider', ['property_id', 'provider_type'])
@Index('idx_accounting_conn_property', ['property_id'])
@Index('idx_accounting_conn_status', ['status'])
export class AccountingConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 20 })
  provider_type: AccountingProviderType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tenant_id: string;

  @Column({ type: 'text', nullable: true })
  access_token_encrypted: string;

  @Column({ type: 'text', nullable: true })
  refresh_token_encrypted: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  token_expires_at: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: AccountingConnectionStatus.PENDING,
  })
  status: AccountingConnectionStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_sync_at: Date;

  @Column({ type: 'text', nullable: true })
  last_error: string;

  @Column({ type: 'jsonb', default: '{}' })
  settings: {
    default_revenue_account_code?: string;
    default_tax_type?: string;
    auto_sync_enabled?: boolean;
    sync_invoices?: boolean;
    sync_payments?: boolean;
    sync_credit_notes?: boolean;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  organisation_name: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
