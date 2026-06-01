import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyUser } from '../../modules/properties/entities/property-user.entity';
import { Permission } from '../permissions/permissions.enum';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PropertyGuard implements CanActivate {
  constructor(
    @InjectRepository(PropertyUser)
    private propertyUsersRepository: Repository<PropertyUser>,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.userId ?? req.user?.sub;
    const propertyId: string | undefined =
      req.params?.propertyId ?? req.params?.id;

    if (!userId || !propertyId) {
      throw new ForbiddenException('Missing user or property context');
    }

    const link = await this.propertyUsersRepository.findOne({
      where: { property_id: propertyId, user_id: userId, is_active: true },
    });

    if (!link) {
      throw new ForbiddenException('No access to this property');
    }

    req.propertyUser = link;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every((p) => link.hasPermission(p));
      if (!hasAll) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }
    }

    return true;
  }
}
