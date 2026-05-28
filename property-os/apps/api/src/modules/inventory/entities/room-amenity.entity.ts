import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { RoomType } from './room-type.entity';

@Entity('room_amenities')
@Unique('uniq_room_amenity', ['room_type_id', 'amenity'])
@Index('idx_room_amenities_type', ['room_type_id'])
export class RoomAmenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  room_type_id: string;

  @Column({ type: 'varchar', length: 100 })
  amenity: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string;

  @ManyToOne(() => RoomType, (rt) => rt.amenities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_type_id' })
  room_type: RoomType;
}
