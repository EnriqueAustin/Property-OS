import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Property } from './property.entity';
import { User } from '../../users/entities/user.entity';
import {
  Permission,
  DEFAULT_PERMISSIONS,
} from '../../../common/permissions/permissions.enum';

export enum PropertyUserRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  STAFF = 'staff',
}

@Entity('property_users')
@Unique('uniq_property_user', ['property_id', 'user_id'])
@Index('idx_property_users_property', ['property_id'])
@Index('idx_property_users_user', ['user_id'])
export class PropertyUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 20, default: PropertyUserRole.STAFF })
  role: PropertyUserRole;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: Permission[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Property, (p) => p.property_users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  hasPermission(permission: Permission): boolean {
    if (this.role === PropertyUserRole.OWNER) return true;
    return Array.isArray(this.permissions) && this.permissions.includes(permission);
  }

  getEffectivePermissions(): Permission[] {
    if (this.role === PropertyUserRole.OWNER) {
      return [...DEFAULT_PERMISSIONS.owner];
    }
    return Array.isArray(this.permissions) ? this.permissions : [];
  }
}
