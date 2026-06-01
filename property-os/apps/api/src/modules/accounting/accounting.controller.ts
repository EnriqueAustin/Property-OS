import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AccountingService } from './accounting.service';
import {
  ConnectAccountingDto,
  OAuthCallbackDto,
  UpdateConnectionSettingsDto,
} from './dto/connect-accounting.dto';

@Controller('properties/:propertyId/accounting')
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly config: ConfigService,
  ) {}

  @Post('connections')
  async connect(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: ConnectAccountingDto,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const redirectUri = `${frontendUrl}/settings/accounting/callback`;
    return this.accountingService.initiateConnection(propertyId, dto.providerType, redirectUri);
  }

  @Get('connections')
  async listConnections(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.accountingService.listConnections(propertyId);
  }

  @Get('connections/:connectionId')
  async getConnection(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    return this.accountingService.getConnectionDetail(connectionId);
  }

  @Get('connections/:connectionId/callback')
  async oauthCallback(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const redirectUri = `${frontendUrl}/settings/accounting/callback`;

    try {
      await this.accountingService.handleOAuthCallback(connectionId, query.code, redirectUri);
      res.redirect(`${frontendUrl}/settings/accounting?connected=true`);
    } catch (err: any) {
      res.redirect(`${frontendUrl}/settings/accounting?error=${encodeURIComponent(err.message)}`);
    }
  }

  @Patch('connections/:connectionId/settings')
  async updateSettings(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Body() dto: UpdateConnectionSettingsDto,
  ) {
    return this.accountingService.updateSettings(connectionId, dto);
  }

  @Delete('connections/:connectionId')
  async disconnect(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    await this.accountingService.disconnect(connectionId);
    return { message: 'Disconnected' };
  }

  @Get('connections/:connectionId/accounts')
  async getAccounts(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    return this.accountingService.getAccounts(connectionId);
  }

  @Post('connections/:connectionId/sync')
  async manualSync(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    return { message: 'Manual sync triggered. Check sync logs for results.' };
  }

  @Post('connections/:connectionId/sync/invoice/:invoiceId')
  async syncInvoice(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.accountingService.syncInvoice(connectionId, invoiceId);
  }

  @Post('connections/:connectionId/sync/payment/:paymentId')
  async syncPayment(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.accountingService.syncPayment(connectionId, paymentId);
  }

  @Get('sync-logs')
  async getSyncLogs(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountingService.getSyncLogsByProperty(
      propertyId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
