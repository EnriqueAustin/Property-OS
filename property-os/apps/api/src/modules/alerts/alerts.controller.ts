import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { UpdateAlertDto, UpdateAlertSettingsDto } from './dto/alert.dto';

@Controller('properties/:propertyId/alerts')
@UseGuards(PropertyGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @RequirePermission(Permission.NOTIFICATIONS_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.alerts.listAlerts(propertyId, status, page ?? 1, limit ?? 20);
  }

  @Get('counts')
  @RequirePermission(Permission.NOTIFICATIONS_VIEW)
  counts(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.alerts.getAlertCounts(propertyId);
  }

  @Patch(':alertId')
  @RequirePermission(Permission.NOTIFICATIONS_MANAGE)
  update(
    @Param('alertId', new ParseUUIDPipe()) alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alerts.updateAlert(alertId, dto.status);
  }

  @Post('scan')
  @RequirePermission(Permission.NOTIFICATIONS_MANAGE)
  scan(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.alerts.scanProperty(propertyId);
  }

  @Get('settings')
  @RequirePermission(Permission.SETTINGS_VIEW)
  getSettings(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.alerts.getSettings(propertyId);
  }

  @Patch('settings')
  @RequirePermission(Permission.SETTINGS_MANAGE)
  updateSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdateAlertSettingsDto,
  ) {
    return this.alerts.updateSettings(propertyId, dto);
  }
}
