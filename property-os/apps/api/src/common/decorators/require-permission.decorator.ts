import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permissions.enum';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
