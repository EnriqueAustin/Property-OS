import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { PropertyGuard } from '../../common/guards/property.guard';

@Controller('properties/:propertyId/reports')
@UseGuards(PropertyGuard)
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('occupancy')
  occupancy(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.reports.occupancyReport(propertyId, startDate, endDate, groupBy);
  }

  @Get('revenue')
  revenue(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.reports.revenueReport(propertyId, startDate, endDate, groupBy);
  }

  @Get('bookings-by-source')
  bookingsBySource(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reports.bookingsBySource(propertyId, startDate, endDate);
  }
}
