import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyUser } from '../../modules/properties/entities/property-user.entity';

@Injectable()
export class PropertyGuard implements CanActivate {
  constructor(
    @InjectRepository(PropertyUser)
    private propertyUsersRepository: Repository<PropertyUser>,
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
    return true;
  }
}
