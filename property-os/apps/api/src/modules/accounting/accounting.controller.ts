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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AccountingService } from './accounting.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import {
  ConnectAccountingDto,
  OAuthCallbackDto,
  UpdateConnectionSettingsDto,
} from './dto/connect-accounting.dto';

@Controller('properties/:propertyId/accounting')
@UseGuards(PropertyGuard)
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly config: ConfigService,
  ) {}

  private userId(req: any): string | undefined {
    return req.user?.userId ?? req.user?.sub;
  }

  @Post('connections')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async connect(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: ConnectAccountingDto,
    @Req() req: any,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const redirectUri = `${frontendUrl}/settings/accounting/callback`;
    return this.accountingService.initiateConnection(
      propertyId,
      dto.providerType,
      redirectUri,
      this.userId(req),
    );
  }

  @Get('connections')
  @RequirePermission(Permission.ACCOUNTING_VIEW)
  async listConnections(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.accountingService.listConnections(propertyId);
  }

  @Get('connections/:connectionId')
  @RequirePermission(Permission.ACCOUNTING_VIEW)
  async getConnection(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    return this.accountingService.getConnectionDetail(connectionId, propertyId);
  }

  @Get('connections/:connectionId/callback')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async oauthCallback(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Query() query: OAuthCallbackDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const redirectUri = `${frontendUrl}/settings/accounting/callback`;

    try {
      await this.accountingService.handleOAuthCallback(
        connectionId,
        query.code,
        redirectUri,
        propertyId,
        query.state,
        this.userId(req),
      );
      res.redirect(`${frontendUrl}/settings/accounting?connected=true`);
    } catch (err: any) {
      res.redirect(`${frontendUrl}/settings/accounting?error=${encodeURIComponent(err.message)}`);
    }
  }

  @Patch('connections/:connectionId/settings')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async updateSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Body() dto: UpdateConnectionSettingsDto,
  ) {
    return this.accountingService.updateSettings(connectionId, dto, propertyId);
  }

  @Delete('connections/:connectionId')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async disconnect(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    await this.accountingService.disconnect(connectionId, propertyId);
    return { message: 'Disconnected' };
  }

  @Get('connections/:connectionId/accounts')
  @RequirePermission(Permission.ACCOUNTING_VIEW)
  async getAccounts(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    return this.accountingService.getAccounts(connectionId, propertyId);
  }

  @Post('connections/:connectionId/sync')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async manualSync(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    // Ensure the connection belongs to this property before acknowledging.
    await this.accountingService.getConnectionDetail(connectionId, propertyId);
    return { message: 'Manual sync triggered. Check sync logs for results.' };
  }

  @Post('connections/:connectionId/sync/invoice/:invoiceId')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async syncInvoice(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.accountingService.syncInvoice(connectionId, invoiceId, propertyId);
  }

  @Post('connections/:connectionId/sync/payment/:paymentId')
  @RequirePermission(Permission.ACCOUNTING_MANAGE)
  async syncPayment(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.accountingService.syncPayment(connectionId, paymentId, propertyId);
  }

  @Get('sync-logs')
  @RequirePermission(Permission.ACCOUNTING_VIEW)
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
