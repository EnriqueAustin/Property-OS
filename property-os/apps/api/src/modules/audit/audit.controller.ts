import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';

@Controller('properties/:propertyId/audit-log')
@UseGuards(PropertyGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission(Permission.AUDIT_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: { page?: number; limit?: number; entityType?: string; action?: string },
  ) {
    return this.audit.listLogs(propertyId, query);
  }
}
