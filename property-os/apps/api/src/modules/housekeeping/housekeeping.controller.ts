import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { HousekeepingService } from './housekeeping.service';
import {
  CreateHousekeepingTaskDto,
  UpdateHousekeepingTaskDto,
  TaskQueryDto,
} from './dto/housekeeping-task.dto';

@Controller('properties/:propertyId/housekeeping')
@UseGuards(PropertyGuard)
export class HousekeepingController {
  constructor(private hkService: HousekeepingService) {}

  @Post()
  @RequirePermission(Permission.HOUSEKEEPING_MANAGE)
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateHousekeepingTaskDto,
  ) {
    return this.hkService.create(propertyId, dto);
  }

  @Get()
  @RequirePermission(Permission.HOUSEKEEPING_VIEW)
  list(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: TaskQueryDto,
  ) {
    return this.hkService.list(propertyId, query);
  }

  @Get('stats')
  @RequirePermission(Permission.HOUSEKEEPING_VIEW)
  stats(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('date') date?: string,
  ) {
    return this.hkService.getStats(propertyId, date);
  }

  @Get('maintenance-summary')
  @RequirePermission(Permission.HOUSEKEEPING_VIEW)
  maintenanceSummary(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.hkService.getMaintenanceSummary(propertyId);
  }

  @Patch(':taskId')
  @RequirePermission(Permission.HOUSEKEEPING_MANAGE)
  update(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateHousekeepingTaskDto,
  ) {
    return this.hkService.update(taskId, dto);
  }

  @Delete(':taskId')
  @RequirePermission(Permission.HOUSEKEEPING_MANAGE)
  remove(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.hkService.remove(taskId);
  }
}
