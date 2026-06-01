import {
  BadRequestException,
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
import { InvoicesService } from './invoices.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';

@Controller()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post('properties/:propertyId/bookings/:bookingId/invoice')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  generate(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() body: { type?: string; includeVat?: boolean; vatRate?: number },
  ) {
    return this.invoices.generateInvoice(propertyId, bookingId, body as any);
  }

  @Get('properties/:propertyId/invoices')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.invoices.listInvoices(propertyId, query);
  }

  @Get('properties/:propertyId/invoices/:invoiceId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.invoices.getInvoice(invoiceId, propertyId);
  }

  @Public()
  @Get('invoices/by-number/:invoiceNumber')
  async getByNumber(
    @Param('invoiceNumber') invoiceNumber: string,
    @Query('email') email?: string,
  ) {
    if (!email) {
      throw new BadRequestException('Email is required for invoice lookup');
    }
    return this.invoices.getInvoiceByNumber(invoiceNumber, email);
  }

  @Patch('properties/:propertyId/invoices/:invoiceId/cancel')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  cancel(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.invoices.cancelInvoice(invoiceId, propertyId);
  }

  @Post('properties/:propertyId/bookings/:bookingId/invoice/send')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  sendInvoice(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.invoices.sendInvoiceEmail(propertyId, bookingId);
  }

  @Post('properties/:propertyId/bookings/:bookingId/credit-note')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.PAYMENTS_MANAGE)
  creditNote(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() body: { refundAmount: number },
  ) {
    return this.invoices.generateCreditNote(propertyId, bookingId, body.refundAmount);
  }
}
