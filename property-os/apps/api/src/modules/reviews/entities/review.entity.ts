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
import { Booking } from '../../bookings/entities/booking.entity';
import { Guest } from '../../bookings/entities/guest.entity';

export enum ReviewStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

@Entity('reviews')
@Index('idx_reviews_property', ['property_id'])
@Index('idx_reviews_booking', ['booking_id'])
@Index('idx_reviews_status', ['property_id', 'status'])
@Unique('uq_review_booking', ['booking_id'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  guest_id: string;

  @Column({ type: 'int' })
  overall_rating: number;

  @Column({ type: 'int', nullable: true })
  cleanliness_rating: number;

  @Column({ type: 'int', nullable: true })
  comfort_rating: number;

  @Column({ type: 'int', nullable: true })
  location_rating: number;

  @Column({ type: 'int', nullable: true })
  value_rating: number;

  @Column({ type: 'int', nullable: true })
  service_rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  owner_response: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  responded_at: Date;

  @Column({ type: 'varchar', length: 20, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;
}
