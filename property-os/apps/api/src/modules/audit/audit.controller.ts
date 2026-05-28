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

@Controller('properties/:propertyId/audit-log')
@UseGuards(PropertyGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: { page?: number; limit?: number; entityType?: string; action?: string },
  ) {
    return this.audit.listLogs(propertyId, query);
  }
}
