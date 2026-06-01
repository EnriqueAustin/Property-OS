import { IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { PropertyUserRole } from '../entities/property-user.entity';
import { Permission } from '../../../common/permissions/permissions.enum';

export class InviteStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(PropertyUserRole)
  role: PropertyUserRole;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}

export class UpdateStaffRoleDto {
  @IsEnum(PropertyUserRole)
  role: PropertyUserRole;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}

export class UpdateStaffPermissionsDto {
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
