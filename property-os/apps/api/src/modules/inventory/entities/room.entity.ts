import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { RoomType } from './room-type.entity';
import { RoomAvailability } from './room-availability.entity';

@Entity('rooms')
@Index('idx_rooms_property', ['property_id'])
@Index('idx_rooms_type', ['room_type_id'])
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  room_type_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  floor: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'room_type_id' })
  room_type: RoomType;

  @OneToMany(() => RoomAvailability, (a) => a.room)
  availability: RoomAvailability[];
}
