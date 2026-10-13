import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PropertyUser, PropertyUserRole } from './entities/property-user.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Property } from './entities/property.entity';
import { InviteStaffDto, UpdateStaffRoleDto, UpdateStaffPermissionsDto } from './dto/staff.dto';
import { EmailProvider } from '../notifications/providers/email.provider';
import {
  Permission,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  PERMISSION_GROUPS,
} from '../../common/permissions/permissions.enum';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 3 days

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    @InjectRepository(PropertyUser)
    private puRepo: Repository<PropertyUser>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @Optional()
    @InjectRepository(Property)
    private propertiesRepo?: Repository<Property>,
    @Optional() private config?: ConfigService,
    // Provided once PropertiesModule wires EmailProvider (see worker report).
    @Optional() private emailProvider?: EmailProvider,
  ) {}

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /** Only an owner may grant or assign the OWNER or MANAGER role. */
  private assertCanAssignRole(requester: PropertyUser, targetRole: PropertyUserRole) {
    if (
      (targetRole === PropertyUserRole.OWNER || targetRole === PropertyUserRole.MANAGER) &&
      requester.role !== PropertyUserRole.OWNER
    ) {
      throw new ForbiddenException('Only an owner can grant owner or manager roles');
    }
  }

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

  async inviteStaff(propertyId: string, dto: InviteStaffDto, requester: PropertyUser) {
    this.assertCanAssignRole(requester, dto.role);

    const email = dto.email.trim().toLowerCase();
    let user = await this.usersRepo.findOne({ where: { email } });
    let isNewUser = false;

    if (user) {
      const existing = await this.puRepo.findOne({
        where: { property_id: propertyId, user_id: user.id },
      });
      if (existing) throw new ConflictException('User is already a member of this property');
    } else {
      isNewUser = true;
      user = this.usersRepo.create({
        email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: dto.phone ?? (null as any),
        role: dto.role === PropertyUserRole.OWNER ? UserRole.OWNER : dto.role === PropertyUserRole.MANAGER ? UserRole.MANAGER : UserRole.STAFF,
        is_active: true,
        email_verified: false,
        password_hash: null as any,
      });
      await this.usersRepo.save(user);
    }

    // New users have no password yet — send a one-time set-password invite link.
    if (isNewUser) {
      await this.sendInvite(user, propertyId);
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

  async updateRole(
    propertyId: string,
    membershipId: string,
    dto: UpdateStaffRoleDto,
    requester: PropertyUser,
  ) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    // Nobody can change their own role (prevents self-escalation).
    if (pu.user_id === requester.user_id) {
      throw new ForbiddenException('You cannot change your own role');
    }

    // Only an owner may change someone who is currently an owner or manager.
    if (
      (pu.role === PropertyUserRole.OWNER || pu.role === PropertyUserRole.MANAGER) &&
      requester.role !== PropertyUserRole.OWNER
    ) {
      throw new ForbiddenException('Only an owner can change an owner or manager role');
    }

    // Only an owner may promote someone to owner or manager.
    this.assertCanAssignRole(requester, dto.role);

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

  async toggleActive(propertyId: string, membershipId: string, requester: PropertyUser) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    if (pu.role === PropertyUserRole.OWNER && requester.role !== PropertyUserRole.OWNER) {
      throw new ForbiddenException('Only an owner can deactivate an owner');
    }

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

  async removeStaff(propertyId: string, membershipId: string, requester: PropertyUser) {
    const pu = await this.puRepo.findOne({ where: { id: membershipId, property_id: propertyId } });
    if (!pu) throw new NotFoundException('Staff member not found');

    if (
      (pu.role === PropertyUserRole.OWNER || pu.role === PropertyUserRole.MANAGER) &&
      requester.role !== PropertyUserRole.OWNER
    ) {
      throw new ForbiddenException('Only an owner can remove an owner or manager');
    }

    if (pu.role === PropertyUserRole.OWNER) {
      const ownerCount = await this.puRepo.count({
        where: { property_id: propertyId, role: PropertyUserRole.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenException('Cannot remove the last owner');
    }

    await this.puRepo.remove(pu);
  }

  // -- Invite email -----------------------------------------------------------

  private async sendInvite(user: User, propertyId: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.invite_token = this.sha256(rawToken);
    user.invite_expires = new Date(Date.now() + INVITE_TTL_MS);
    await this.usersRepo.save(user);

    const frontendUrl =
      this.config?.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const link = `${frontendUrl}/accept-invite?token=${rawToken}`;

    let propertyName = 'your property';
    try {
      const property = await this.propertiesRepo?.findOne({ where: { id: propertyId } });
      if (property?.name) propertyName = property.name;
    } catch {
      /* best-effort */
    }

    if (!this.emailProvider) {
      this.logger.warn(
        `Invite created for ${user.email} but no EmailProvider is wired into PropertiesModule — email not sent.`,
      );
      return;
    }

    try {
      const result = await this.emailProvider.send({
        to: user.email,
        subject: `You've been invited to ${propertyName} on PropertyOS`,
        html: this.inviteEmail(user.first_name, propertyName, link),
      });
      if (!result.success) {
        this.logger.warn(`Invite email to ${user.email} not sent: ${result.error}`);
      }
    } catch (err: any) {
      this.logger.error(`Invite email to ${user.email} failed: ${err.message}`);
    }
  }

  private inviteEmail(firstName: string, propertyName: string, link: string): string {
    const name = firstName ? firstName : 'there';
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin:0 0 16px;">You've been invited</h2>
        <p>Hi ${name},</p>
        <p>You've been invited to join <strong>${propertyName}</strong> on PropertyOS. Click the button below to set your password and activate your account. This link expires in 3 days.</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;">Set your password</a>
        </p>
        <p style="color:#475569;font-size:13px;">If you weren't expecting this invitation, you can ignore this email.</p>
      </div>
    `;
  }
}
