import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum InvoiceType {
  PROFORMA = 'proforma',
  TAX_INVOICE = 'tax_invoice',
  CREDIT_NOTE = 'credit_note',
}

@Entity('invoices')
@Index('idx_invoices_booking', ['booking_id'])
@Index('idx_invoices_property', ['property_id'])
@Index('idx_invoices_number', ['invoice_number'], { unique: true })
@Index('idx_invoices_status', ['status'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  invoice_number: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 20, default: InvoiceType.TAX_INVOICE })
  invoice_type: InvoiceType;

  @Column({ type: 'varchar', length: 20, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'date' })
  issue_date: string;

  @Column({ type: 'date' })
  due_date: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  vat_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  vat_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @Column({ type: 'jsonb' })
  line_items: InvoiceLineItem[];

  @Column({ type: 'jsonb', nullable: true })
  guest_details: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  property_details: {
    name: string;
    address: string;
    email?: string;
    phone?: string;
    vat_number?: string;
  };

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}
