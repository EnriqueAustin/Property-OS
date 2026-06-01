import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Guest } from '../../bookings/entities/guest.entity';
import { Property } from '../../properties/entities/property.entity';

export enum ConsentType {
  DATA_PROCESSING = 'data_processing',
  MARKETING_EMAIL = 'marketing_email',
  MARKETING_WHATSAPP = 'marketing_whatsapp',
  THIRD_PARTY_SHARING = 'third_party_sharing',
}

export enum ConsentStatus {
  GRANTED = 'granted',
  WITHDRAWN = 'withdrawn',
}

@Entity('guest_consents')
@Index('idx_consent_guest', ['guest_id'])
@Index('idx_consent_property', ['property_id'])
export class GuestConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  guest_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 50 })
  consent_type: ConsentType;

  @Column({ type: 'varchar', length: 20, default: ConsentStatus.GRANTED })
  status: ConsentStatus;

  @Column({ type: 'text', nullable: true })
  purpose: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  granted_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  withdrawn_at: Date;

  @ManyToOne(() => Guest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
