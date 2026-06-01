import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { TourismLevyService } from './tourism-levy.service';
import { UpdateTourismLevySettingsDto } from './dto/tourism-levy.dto';

@Controller('properties/:propertyId/tourism-levy')
@UseGuards(PropertyGuard)
export class TourismLevyController {
  constructor(private levyService: TourismLevyService) {}

  @Get('settings')
  @RequirePermission(Permission.SETTINGS_VIEW)
  getSettings(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.levyService.getSettings(propertyId);
  }

  @Patch('settings')
  @RequirePermission(Permission.SETTINGS_MANAGE)
  updateSettings(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpdateTourismLevySettingsDto,
  ) {
    return this.levyService.updateSettings(propertyId, dto);
  }

  @Get('report')
  @RequirePermission(Permission.REPORTS_VIEW)
  getReport(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.levyService.getReport(propertyId, startDate, endDate);
  }

  @Get('report/monthly')
  @RequirePermission(Permission.REPORTS_VIEW)
  getMonthlyReport(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('year') year: string,
  ) {
    const y = parseInt(year, 10) || new Date().getFullYear();
    return this.levyService.getMonthlyReport(propertyId, y);
  }
}
