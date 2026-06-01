import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyUser, PropertyUserRole } from './entities/property-user.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { InviteStaffDto, UpdateStaffRoleDto, UpdateStaffPermissionsDto } from './dto/staff.dto';
import {
  Permission,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  PERMISSION_GROUPS,
} from '../../common/permissions/permissions.enum';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(PropertyUser)
    private puRepo: Repository<PropertyUser>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async listStaff(propertyId: string) {
    const members = await this.puRepo.find({
      where: { property_id: propertyId },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });

    return members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      permissions: m.getEffectivePermissions(),
      is_active: m.is_active,
      created_at: m.created_at,
      first_name: m.user?.first_name,
      last_name: m.user?.last_name,
      email: m.user?.email,
      phone: m.user?.phone,
      last_login_at: m.user?.last_login_at,
    }));
  }

  async inviteStaff(propertyId: string, dto: InviteStaffDto) {
    let user = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });

    if (user) {
      const existing = await this.puRepo.findOne({
        where: { property_id: propertyId, user_id: user.id },
      });
      if (existing) throw new ConflictException('User is already a member of this property');
    } else {
      user = this.usersRepo.create({
        email: dto.email.toLowerCase(),
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: dto.phone ?? (null as any),
        role: dto.role === PropertyUserRole.OWNER ? UserRole.OWNER : dto.role === PropertyUserRole.MANAGER ? UserRole.MANAGER : UserRole.STAFF,
        is_active: true,
        email_verified: false,
      });
      await this.usersRepo.save(user);
    }

    const permissions = dto.permissions ?? DEFAULT_PERMISSIONS[dto.role] ?? [];

    const pu = this.puRepo.create({
      property_id: propertyId,
      user_id: user.id,
      role: dto.role,
      permissions,
      is_active: true,
    });
    await this.puRepo.save(pu);

    return {
      id: pu.id,
      user_id: user.id,
      role: pu.role,
      permissions: pu.getEffectivePermissions(),
      is_active: pu.is_active,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    };
  }

  async updateRole(propertyId: string, membershipId: string, dto: UpdateStaffRoleDto) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    if (pu.role === PropertyUserRole.OWNER && dto.role !== PropertyUserRole.OWNER) {
      const ownerCount = await this.puRepo.count({
        where: { property_id: propertyId, role: PropertyUserRole.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenException('Cannot remove the last owner');
    }

    pu.role = dto.role;
    if (dto.permissions) {
      pu.permissions = dto.permissions;
    } else if (pu.role !== dto.role) {
      pu.permissions = DEFAULT_PERMISSIONS[dto.role] ?? [];
    }
    await this.puRepo.save(pu);

    return {
      id: pu.id,
      role: pu.role,
      permissions: pu.getEffectivePermissions(),
      is_active: pu.is_active,
    };
  }

  async updatePermissions(
    propertyId: string,
    membershipId: string,
    dto: UpdateStaffPermissionsDto,
    requestingUser: PropertyUser,
  ) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    if (pu.role === PropertyUserRole.OWNER) {
      throw new ForbiddenException('Owner permissions cannot be restricted');
    }

    if (
      requestingUser.role !== PropertyUserRole.OWNER &&
      requestingUser.role !== PropertyUserRole.MANAGER
    ) {
      throw new ForbiddenException('Only owners and managers can edit permissions');
    }

    if (requestingUser.role === PropertyUserRole.MANAGER) {
      const managerPerms = requestingUser.getEffectivePermissions();
      const hasEscalation = dto.permissions.some((p) => !managerPerms.includes(p));
      if (hasEscalation) {
        throw new ForbiddenException('Cannot grant permissions you do not have');
      }
    }

    const validPermissions = dto.permissions.filter((p) =>
      ALL_PERMISSIONS.includes(p),
    );
    pu.permissions = validPermissions;
    await this.puRepo.save(pu);

    return {
      id: pu.id,
      role: pu.role,
      permissions: pu.getEffectivePermissions(),
      is_active: pu.is_active,
    };
  }

  getPermissionSchema() {
    return {
      all_permissions: ALL_PERMISSIONS,
      groups: PERMISSION_GROUPS,
      defaults: DEFAULT_PERMISSIONS,
    };
  }

  async toggleActive(propertyId: string, membershipId: string) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    if (pu.role === PropertyUserRole.OWNER && pu.is_active) {
      const activeOwners = await this.puRepo.count({
        where: { property_id: propertyId, role: PropertyUserRole.OWNER, is_active: true },
      });
      if (activeOwners <= 1) throw new ForbiddenException('Cannot deactivate the last active owner');
    }

    pu.is_active = !pu.is_active;
    await this.puRepo.save(pu);
    return pu;
  }

  async removeStaff(propertyId: string, membershipId: string) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    if (pu.role === PropertyUserRole.OWNER) {
      const ownerCount = await this.puRepo.count({
        where: { property_id: propertyId, role: PropertyUserRole.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenException('Cannot remove the last owner');
    }

    await this.puRepo.remove(pu);
  }
}
