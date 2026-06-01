import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  AccountingConnection,
  AccountingConnectionStatus,
  AccountingProviderType,
} from './entities/accounting-connection.entity';
import {
  AccountingMapping,
  AccountingEntityType,
  AccountingSyncStatus,
} from './entities/accounting-mapping.entity';
import {
  AccountingSyncLog,
  SyncDirection,
  SyncLogStatus,
} from './entities/accounting-sync-log.entity';
import { AccountingProviderRegistry } from './providers/accounting-provider.registry';
import {
  AccountingContactDto,
  AccountingInvoiceDto,
  AccountingPaymentDto,
  AccountingCreditNoteDto,
  TokenSet,
} from './providers/accounting-provider.interface';
import { UpdateConnectionSettingsDto } from './dto/connect-accounting.dto';
import { encrypt, decrypt } from './crypto.util';
import { Invoice } from '../payments/entities/invoice.entity';
import { Payment, PaymentStatus, PaymentType } from '../payments/entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Guest } from '../bookings/entities/guest.entity';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(AccountingConnection)
    private connectionsRepo: Repository<AccountingConnection>,
    @InjectRepository(AccountingMapping)
    private mappingsRepo: Repository<AccountingMapping>,
    @InjectRepository(AccountingSyncLog)
    private syncLogsRepo: Repository<AccountingSyncLog>,
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Guest)
    private guestsRepo: Repository<Guest>,
    private readonly registry: AccountingProviderRegistry,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.get<string>('ACCOUNTING_ENCRYPTION_KEY', 'dev-key-change-in-production');
  }

  // --- Connection Management ---

  async initiateConnection(
    propertyId: string,
    providerType: AccountingProviderType,
    redirectUri: string,
  ): Promise<{ authUrl: string; connectionId: string }> {
    const existing = await this.connectionsRepo.findOne({
      where: { property_id: propertyId, provider_type: providerType },
    });
    if (existing && existing.status === AccountingConnectionStatus.ACTIVE) {
      throw new BadRequestException(`Already connected to ${providerType}`);
    }

    const connection = existing || this.connectionsRepo.create({
      property_id: propertyId,
      provider_type: providerType,
      settings: {
        auto_sync_enabled: true,
        sync_invoices: true,
        sync_payments: true,
        sync_credit_notes: true,
      },
    });
    connection.status = AccountingConnectionStatus.PENDING;
    const saved = await this.connectionsRepo.save(connection);

    const provider = this.registry.getOrThrow(providerType);
    const authUrl = provider.getAuthUrl(redirectUri, saved.id);

    return { authUrl, connectionId: saved.id };
  }

  async handleOAuthCallback(
    connectionId: string,
    code: string,
    redirectUri: string,
  ): Promise<AccountingConnection> {
    const connection = await this.getConnection(connectionId);
    const provider = this.registry.getOrThrow(connection.provider_type);

    const tokens = await provider.handleCallback(code, redirectUri);
    return this.saveTokens(connection, tokens);
  }

  async listConnections(propertyId: string): Promise<AccountingConnection[]> {
    const connections = await this.connectionsRepo.find({
      where: { property_id: propertyId },
      order: { created_at: 'ASC' },
    });
    return connections.map((c) => this.sanitizeConnection(c));
  }

  async getConnectionDetail(connectionId: string): Promise<AccountingConnection> {
    const conn = await this.getConnection(connectionId);
    return this.sanitizeConnection(conn);
  }

  async updateSettings(
    connectionId: string,
    dto: UpdateConnectionSettingsDto,
  ): Promise<AccountingConnection> {
    const conn = await this.getConnection(connectionId);
    conn.settings = {
      ...conn.settings,
      ...(dto.defaultRevenueAccountCode !== undefined && { default_revenue_account_code: dto.defaultRevenueAccountCode }),
      ...(dto.defaultTaxType !== undefined && { default_tax_type: dto.defaultTaxType }),
      ...(dto.autoSyncEnabled !== undefined && { auto_sync_enabled: dto.autoSyncEnabled }),
      ...(dto.syncInvoices !== undefined && { sync_invoices: dto.syncInvoices }),
      ...(dto.syncPayments !== undefined && { sync_payments: dto.syncPayments }),
      ...(dto.syncCreditNotes !== undefined && { sync_credit_notes: dto.syncCreditNotes }),
    };
    const saved = await this.connectionsRepo.save(conn);
    return this.sanitizeConnection(saved);
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = await this.getConnection(connectionId);
    conn.status = AccountingConnectionStatus.DISCONNECTED;
    conn.access_token_encrypted = null as any;
    conn.refresh_token_encrypted = null as any;
    conn.token_expires_at = null as any;
    await this.connectionsRepo.save(conn);
  }

  async getAccounts(connectionId: string) {
    const conn = await this.getConnection(connectionId);
    await this.ensureTokenFresh(conn);
    const provider = this.registry.getOrThrow(conn.provider_type);
    return provider.getAccounts(conn);
  }

  // --- Sync Operations ---

  async syncInvoice(
    connectionId: string,
    invoiceId: string,
  ): Promise<AccountingMapping> {
    const conn = await this.getConnection(connectionId);
    if (conn.status !== AccountingConnectionStatus.ACTIVE) {
      throw new BadRequestException('Connection is not active');
    }

    await this.ensureTokenFresh(conn);
    const provider = this.registry.getOrThrow(conn.provider_type);
    const start = Date.now();

    const invoice = await this.invoicesRepo.findOne({
      where: { id: invoiceId },
      relations: ['booking', 'booking.guest'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    try {
      const contactRef = await this.ensureContact(conn, provider, invoice.booking?.guest);

      const invoiceDto: AccountingInvoiceDto = {
        internal_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_provider_ref: contactRef,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        currency: invoice.currency,
        line_items: invoice.line_items.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          account_code: conn.settings?.default_revenue_account_code,
          tax_type: conn.settings?.default_tax_type,
        })),
        subtotal: Number(invoice.subtotal),
        tax_amount: Number(invoice.vat_amount),
        total: Number(invoice.total),
        reference: `Booking ${invoice.booking?.reference_number || ''}`.trim(),
      };

      const result = await provider.createInvoice(conn, invoiceDto);

      const mapping = await this.upsertMapping(
        conn.id,
        AccountingEntityType.INVOICE,
        invoiceId,
        result.provider_ref,
      );

      await this.logSync(conn.id, AccountingEntityType.INVOICE, invoiceId, SyncLogStatus.SUCCESS, null, Date.now() - start);
      this.logger.log(`Invoice ${invoice.invoice_number} synced to ${conn.provider_type}`);
      return mapping;
    } catch (err: any) {
      await this.logSync(conn.id, AccountingEntityType.INVOICE, invoiceId, SyncLogStatus.FAILED, err.message, Date.now() - start);
      await this.markConnectionError(conn, err.message);
      throw err;
    }
  }

  async syncPayment(
    connectionId: string,
    paymentId: string,
  ): Promise<AccountingMapping> {
    const conn = await this.getConnection(connectionId);
    if (conn.status !== AccountingConnectionStatus.ACTIVE) {
      throw new BadRequestException('Connection is not active');
    }

    await this.ensureTokenFresh(conn);
    const provider = this.registry.getOrThrow(conn.provider_type);
    const start = Date.now();

    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    try {
      const invoiceMapping = await this.mappingsRepo.findOne({
        where: {
          connection_id: conn.id,
          entity_type: AccountingEntityType.INVOICE,
          internal_id: payment.booking_id,
        },
      });

      let invoiceProviderRef: string;
      if (invoiceMapping) {
        invoiceProviderRef = invoiceMapping.provider_ref;
      } else {
        const invoice = await this.invoicesRepo.findOne({
          where: { booking_id: payment.booking_id },
          order: { created_at: 'DESC' },
        });
        if (!invoice) throw new BadRequestException('No invoice found for this booking');
        const synced = await this.syncInvoice(conn.id, invoice.id);
        invoiceProviderRef = synced.provider_ref;
      }

      const paymentDto: AccountingPaymentDto = {
        internal_id: paymentId,
        invoice_provider_ref: invoiceProviderRef,
        amount: Number(payment.amount),
        currency: payment.currency,
        date: (payment.paid_at || payment.created_at).toISOString().slice(0, 10),
        reference: payment.eft_reference || payment.provider_ref || `Payment ${paymentId.slice(0, 8)}`,
      };

      const result = await provider.recordPayment(conn, paymentDto);

      const mapping = await this.upsertMapping(
        conn.id,
        AccountingEntityType.PAYMENT,
        paymentId,
        result.provider_ref,
      );

      await this.logSync(conn.id, AccountingEntityType.PAYMENT, paymentId, SyncLogStatus.SUCCESS, null, Date.now() - start);
      return mapping;
    } catch (err: any) {
      await this.logSync(conn.id, AccountingEntityType.PAYMENT, paymentId, SyncLogStatus.FAILED, err.message, Date.now() - start);
      await this.markConnectionError(conn, err.message);
      throw err;
    }
  }

  async syncCreditNote(
    connectionId: string,
    bookingId: string,
    refundAmount: number,
  ): Promise<AccountingMapping> {
    const conn = await this.getConnection(connectionId);
    if (conn.status !== AccountingConnectionStatus.ACTIVE) {
      throw new BadRequestException('Connection is not active');
    }

    await this.ensureTokenFresh(conn);
    const provider = this.registry.getOrThrow(conn.provider_type);
    const start = Date.now();

    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    try {
      const contactRef = await this.ensureContact(conn, provider, booking.guest);

      const creditNoteDto: AccountingCreditNoteDto = {
        internal_id: bookingId,
        contact_provider_ref: contactRef,
        date: new Date().toISOString().slice(0, 10),
        currency: booking.currency,
        line_items: [{
          description: `Refund for booking ${booking.reference_number}`,
          quantity: 1,
          unit_price: refundAmount,
          account_code: conn.settings?.default_revenue_account_code,
          tax_type: conn.settings?.default_tax_type,
        }],
        total: refundAmount,
        reference: `Refund - ${booking.reference_number}`,
      };

      const result = await provider.createCreditNote(conn, creditNoteDto);

      const mapping = await this.upsertMapping(
        conn.id,
        AccountingEntityType.CREDIT_NOTE,
        bookingId,
        result.provider_ref,
      );

      await this.logSync(conn.id, AccountingEntityType.CREDIT_NOTE, bookingId, SyncLogStatus.SUCCESS, null, Date.now() - start);
      return mapping;
    } catch (err: any) {
      await this.logSync(conn.id, AccountingEntityType.CREDIT_NOTE, bookingId, SyncLogStatus.FAILED, err.message, Date.now() - start);
      await this.markConnectionError(conn, err.message);
      throw err;
    }
  }

  async voidInvoiceInAccounting(
    connectionId: string,
    invoiceId: string,
  ): Promise<void> {
    const conn = await this.getConnection(connectionId);
    if (conn.status !== AccountingConnectionStatus.ACTIVE) return;

    const mapping = await this.mappingsRepo.findOne({
      where: {
        connection_id: conn.id,
        entity_type: AccountingEntityType.INVOICE,
        internal_id: invoiceId,
      },
    });
    if (!mapping) return;

    await this.ensureTokenFresh(conn);
    const provider = this.registry.getOrThrow(conn.provider_type);
    const start = Date.now();

    try {
      await provider.voidInvoice(conn, mapping.provider_ref);
      mapping.sync_status = AccountingSyncStatus.SYNCED;
      await this.mappingsRepo.save(mapping);
      await this.logSync(conn.id, AccountingEntityType.INVOICE, invoiceId, SyncLogStatus.SUCCESS, null, Date.now() - start);
    } catch (err: any) {
      await this.logSync(conn.id, AccountingEntityType.INVOICE, invoiceId, SyncLogStatus.FAILED, err.message, Date.now() - start);
    }
  }

  // --- Sync Log ---

  async getSyncLogs(connectionId: string, limit = 50) {
    return this.syncLogsRepo.find({
      where: { connection_id: connectionId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getSyncLogsByProperty(propertyId: string, limit = 50) {
    const connections = await this.connectionsRepo.find({
      where: { property_id: propertyId },
    });
    if (connections.length === 0) return [];

    return this.syncLogsRepo.find({
      where: connections.map((c) => ({ connection_id: c.id })),
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  // --- Active connections for a property (used by event listener) ---

  async getActiveConnections(propertyId: string): Promise<AccountingConnection[]> {
    return this.connectionsRepo.find({
      where: {
        property_id: propertyId,
        status: AccountingConnectionStatus.ACTIVE,
      },
    });
  }

  // --- Internal Helpers ---

  private async getConnection(connectionId: string): Promise<AccountingConnection> {
    const conn = await this.connectionsRepo.findOne({
      where: { id: connectionId },
    });
    if (!conn) throw new NotFoundException('Accounting connection not found');
    return conn;
  }

  private async ensureTokenFresh(conn: AccountingConnection): Promise<void> {
    if (!conn.token_expires_at) return;
    const bufferMs = 2 * 60 * 1000;
    if (conn.token_expires_at.getTime() - Date.now() > bufferMs) return;

    const provider = this.registry.getOrThrow(conn.provider_type);
    const tokens = await provider.refreshToken(conn);
    await this.saveTokens(conn, tokens);
  }

  private async saveTokens(
    conn: AccountingConnection,
    tokens: TokenSet,
  ): Promise<AccountingConnection> {
    conn.access_token_encrypted = encrypt(tokens.access_token, this.encryptionKey);
    conn.refresh_token_encrypted = encrypt(tokens.refresh_token, this.encryptionKey);
    conn.token_expires_at = tokens.expires_at;
    conn.status = AccountingConnectionStatus.ACTIVE;
    conn.last_error = null as any;
    if (tokens.tenant_id) conn.tenant_id = tokens.tenant_id;
    if (tokens.organisation_name) conn.organisation_name = tokens.organisation_name;
    return this.connectionsRepo.save(conn);
  }

  private async ensureContact(
    conn: AccountingConnection,
    provider: any,
    guest?: Guest,
  ): Promise<string> {
    if (!guest) throw new BadRequestException('No guest associated with this booking');

    const existing = await this.mappingsRepo.findOne({
      where: {
        connection_id: conn.id,
        entity_type: AccountingEntityType.CONTACT,
        internal_id: guest.id,
      },
    });
    if (existing) return existing.provider_ref;

    const contactDto: AccountingContactDto = {
      internal_id: guest.id,
      name: `${guest.first_name} ${guest.last_name}`.trim(),
      first_name: guest.first_name,
      last_name: guest.last_name,
      email: guest.email,
      phone: guest.phone,
    };

    const result = await provider.upsertContact(conn, contactDto);

    await this.upsertMapping(
      conn.id,
      AccountingEntityType.CONTACT,
      guest.id,
      result.provider_ref,
    );

    return result.provider_ref;
  }

  private async upsertMapping(
    connectionId: string,
    entityType: AccountingEntityType,
    internalId: string,
    providerRef: string,
  ): Promise<AccountingMapping> {
    let mapping = await this.mappingsRepo.findOne({
      where: { connection_id: connectionId, entity_type: entityType, internal_id: internalId },
    });

    if (mapping) {
      mapping.provider_ref = providerRef;
      mapping.sync_status = AccountingSyncStatus.SYNCED;
      mapping.last_synced_at = new Date();
      mapping.last_error = null as any;
    } else {
      mapping = this.mappingsRepo.create({
        connection_id: connectionId,
        entity_type: entityType,
        internal_id: internalId,
        provider_ref: providerRef,
        sync_status: AccountingSyncStatus.SYNCED,
        last_synced_at: new Date(),
      });
    }

    return this.mappingsRepo.save(mapping);
  }

  private async logSync(
    connectionId: string,
    entityType: AccountingEntityType,
    internalId: string,
    status: SyncLogStatus,
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    const log = this.syncLogsRepo.create({
      connection_id: connectionId,
      entity_type: entityType,
      internal_id: internalId,
      status,
      error_message: errorMessage || undefined,
      duration_ms: durationMs,
    });
    await this.syncLogsRepo.save(log);
  }

  private async markConnectionError(conn: AccountingConnection, error: string): Promise<void> {
    conn.last_error = error;
    if (error.includes('401') || error.includes('invalid_grant') || error.includes('token')) {
      conn.status = AccountingConnectionStatus.ERROR;
    }
    await this.connectionsRepo.save(conn);
  }

  private sanitizeConnection(conn: AccountingConnection): AccountingConnection {
    const sanitized = { ...conn };
    delete (sanitized as any).access_token_encrypted;
    delete (sanitized as any).refresh_token_encrypted;
    return sanitized;
  }
}
