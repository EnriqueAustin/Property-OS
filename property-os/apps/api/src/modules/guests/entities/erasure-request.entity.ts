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

export enum ErasureRequestStatus {
  // Confirmation email sent, awaiting the guest to click the link.
  PENDING = 'pending',
  // Guest confirmed; anonymisation is scheduled after the grace period.
  CONFIRMED = 'confirmed',
  // Guest (or property) cancelled before anonymisation ran.
  CANCELLED = 'cancelled',
  // Anonymisation has been performed.
  COMPLETED = 'completed',
}

/**
 * A POPIA right-to-erasure request (audit S5). Erasure is no longer instant:
 * the request is created in PENDING with a hashed confirmation token and a
 * 24h expiry, confirmation schedules anonymisation after a grace period, and
 * a scheduled job performs the anonymisation once that period elapses.
 */
@Entity('erasure_requests')
@Index('idx_erasure_token', ['token_hash'])
@Index('idx_erasure_status', ['status'])
export class ErasureRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  guest_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  // SHA-256 hash of the confirmation token (the raw token is only emailed).
  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ErasureRequestStatus.PENDING,
  })
  status: ErasureRequestStatus;

  // Expiry of the confirmation link (24h from creation).
  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  // When anonymisation becomes due (set on confirmation = now + grace period).
  @Column({ type: 'timestamp with time zone', nullable: true })
  scheduled_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  confirmed_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  cancelled_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Guest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
