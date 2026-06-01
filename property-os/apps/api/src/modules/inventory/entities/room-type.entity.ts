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
import { RoomAmenity } from './room-amenity.entity';
import { Room } from './room.entity';

@Entity('room_types')
@Index('idx_room_types_property', ['property_id'])
export class RoomType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  base_price: number;

  @Column({ type: 'int', default: 2 })
  max_occupancy: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bed_type: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  size_sqm: number;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 2 })
  base_occupancy: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  single_occupancy_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  extra_person_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  child_rate: number;

  @Column({ type: 'jsonb', default: '[]' })
  photos: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @OneToMany(() => RoomAmenity, (a) => a.room_type, { cascade: true })
  amenities: RoomAmenity[];

  @OneToMany(() => Room, (r) => r.room_type)
  rooms: Room[];
}
