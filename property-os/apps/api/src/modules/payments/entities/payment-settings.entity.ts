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

@Entity('payment_settings')
export class PaymentSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  property_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payfast_merchant_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payfast_merchant_key: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payfast_passphrase: string;

  @Column({ type: 'boolean', default: true })
  payfast_sandbox: boolean;

  @Column({ type: 'boolean', default: false })
  payfast_enabled: boolean;

  @Column({ type: 'boolean', default: false })
  snapscan_enabled: boolean;

  @Column({ type: 'boolean', default: false })
  eft_enabled: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eft_bank_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eft_account_holder: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  eft_account_number: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  eft_branch_code: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  eft_account_type: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
