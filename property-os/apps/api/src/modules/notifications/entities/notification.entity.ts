import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum NotificationChannel {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
}

export enum NotificationTemplate {
  BOOKING_CONFIRMATION = 'booking_confirmation',
  BOOKING_CANCELLATION = 'booking_cancellation',
  NEW_BOOKING_ALERT = 'new_booking_alert',
  PAYMENT_RECEIVED = 'payment_received',
  BOOKING_MODIFIED = 'booking_modified',
  PAYMENT_REMINDER = 'payment_reminder',
  PRE_ARRIVAL = 'pre_arrival',
  CHECK_IN_INSTRUCTIONS = 'check_in_instructions',
  POST_STAY_REVIEW = 'post_stay_review',
}

export enum RecipientType {
  GUEST = 'guest',
  OWNER = 'owner',
  STAFF = 'staff',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('notifications')
@Index('idx_notifications_property', ['property_id'])
@Index('idx_notifications_booking', ['booking_id'])
@Index('idx_notifications_status', ['status'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid', nullable: true })
  booking_id: string;

  @Column({ type: 'varchar', length: 20 })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 50 })
  template: NotificationTemplate;

  @Column({ type: 'varchar', length: 20 })
  recipient_type: RecipientType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient_email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  recipient_phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ type: 'varchar', length: 20, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  sent_at: Date;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  provider: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_ref: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
