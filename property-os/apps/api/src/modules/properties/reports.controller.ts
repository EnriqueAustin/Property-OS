import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { PdfReportService } from './pdf-report.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';

@Controller('properties/:propertyId/reports')
@UseGuards(PropertyGuard)
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly pdfReports: PdfReportService,
  ) {}

  @Get('occupancy')
  @RequirePermission(Permission.REPORTS_VIEW)
  occupancy(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.reports.occupancyReport(propertyId, startDate, endDate, groupBy);
  }

  @Get('revenue')
  @RequirePermission(Permission.REPORTS_VIEW)
  revenue(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.reports.revenueReport(propertyId, startDate, endDate, groupBy);
  }

  @Get('bookings-by-source')
  @RequirePermission(Permission.REPORTS_VIEW)
  bookingsBySource(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reports.bookingsBySource(propertyId, startDate, endDate);
  }

  @Get('financial-summary')
  @RequirePermission(Permission.REPORTS_VIEW)
  financialSummary(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reports.financialSummary(propertyId, startDate, endDate);
  }

  @Get('tax')
  @RequirePermission(Permission.REPORTS_VIEW)
  taxReport(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.reports.taxReport(propertyId, startDate, endDate, groupBy);
  }

  @Get('refunds')
  @RequirePermission(Permission.REPORTS_VIEW)
  refundReport(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reports.refundReport(propertyId, startDate, endDate);
  }

  @Get('outstanding-balances')
  @RequirePermission(Permission.REPORTS_VIEW)
  outstandingBalances(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.reports.outstandingBalancesReport(propertyId);
  }

  @Get('payment-methods')
  @RequirePermission(Permission.REPORTS_VIEW)
  paymentMethods(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reports.paymentMethodBreakdown(propertyId, startDate, endDate);
  }

  @Get('kpi')
  @RequirePermission(Permission.REPORTS_VIEW)
  kpiReport(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reports.kpiReport(propertyId, startDate, endDate);
  }

  @Get('year-over-year')
  @RequirePermission(Permission.REPORTS_VIEW)
  yearOverYear(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('year') year: string,
  ) {
    const y = parseInt(year, 10) || new Date().getFullYear();
    return this.reports.yearOverYear(propertyId, y);
  }

  @Get('export/csv')
  @RequirePermission(Permission.REPORTS_VIEW)
  async exportCsv(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: string,
    @Res() res: Response,
  ) {
    const csv = await this.reports.exportCsv(propertyId, type, startDate, endDate, groupBy);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${startDate}-to-${endDate}.csv"`);
    res.send(csv);
  }

  @Get('export/pdf')
  @RequirePermission(Permission.REPORTS_VIEW)
  async exportPdf(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: string,
    @Res() res: Response,
  ) {
    const pdf = await this.pdfReports.generatePdf(propertyId, type, startDate, endDate, groupBy);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${startDate}-to-${endDate}.pdf"`);
    res.send(pdf);
  }
}
