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

@Entity('guests')
@Index('idx_guests_property', ['property_id'])
@Index('idx_guests_email', ['email'])
@Index('idx_guests_phone', ['phone'])
@Index('idx_guests_name', ['property_id', 'last_name', 'first_name'])
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  id_number: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'int', default: 0 })
  total_stays: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_revenue: number;

  @Column({ type: 'date', nullable: true })
  last_stay_date: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
