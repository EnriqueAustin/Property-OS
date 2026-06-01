import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IAccountingProvider,
  TokenSet,
  ProviderRef,
  ProviderAccount,
  AccountingContactDto,
  AccountingInvoiceDto,
  AccountingPaymentDto,
  AccountingCreditNoteDto,
} from '../accounting-provider.interface';
import { AccountingConnection } from '../../entities/accounting-connection.entity';
import { decrypt } from '../../crypto.util';

const SAGE_AUTH_URL = 'https://www.sageone.com/oauth2/auth/central';
const SAGE_TOKEN_URL = 'https://oauth.accounting.sage.com/token';
const SAGE_API_BASE = 'https://api.accounting.sage.com/v3.1';

@Injectable()
export class SageProvider implements IAccountingProvider {
  readonly providerType = 'sage';
  private readonly logger = new Logger(SageProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly encryptionKey: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('SAGE_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('SAGE_CLIENT_SECRET', '');
    this.encryptionKey = this.config.get<string>('ACCOUNTING_ENCRYPTION_KEY', 'dev-key-change-in-production');
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'full_access',
      state,
      filter: 'apiv3.1',
    });
    return `${SAGE_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await axios.post(
      SAGE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const client = this.createClient(access_token);

    let tenantId: string | undefined;
    let organisationName: string | undefined;
    try {
      const bizRes = await client.get('/businesses');
      const biz = bizRes.data?.$items?.[0];
      tenantId = biz?.id;
      organisationName = biz?.name;
    } catch {
      this.logger.warn('Could not fetch Sage business info');
    }

    return {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
      tenant_id: tenantId,
      organisation_name: organisationName,
    };
  }

  async refreshToken(connection: AccountingConnection): Promise<TokenSet> {
    const currentRefresh = decrypt(connection.refresh_token_encrypted, this.encryptionKey);

    const response = await axios.post(
      SAGE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefresh,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const { access_token, refresh_token, expires_in } = response.data;
    return {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
      tenant_id: connection.tenant_id,
    };
  }

  async upsertContact(
    connection: AccountingConnection,
    contact: AccountingContactDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    const existing = await this.findContactByEmail(client, contact.email);
    if (existing) {
      return { provider_ref: existing.id };
    }

    const body = {
      contact_type_ids: ['CUSTOMER'],
      name: contact.name,
      main_address: contact.address
        ? {
            address_line_1: contact.address,
            city: contact.city,
            region: contact.province,
            postal_code: contact.postal_code,
            country_id: this.mapCountry(contact.country),
          }
        : undefined,
      email: contact.email,
      telephone: contact.phone,
    };

    const response = await client.post('/contacts', { contact: body });
    return {
      provider_ref: response.data?.id || '',
      provider_data: { name: response.data?.name },
    };
  }

  async createInvoice(
    connection: AccountingConnection,
    invoice: AccountingInvoiceDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    const lineItems = invoice.line_items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      ledger_account_id: item.account_code || connection.settings?.default_revenue_account_code,
      tax_rate_id: item.tax_type || connection.settings?.default_tax_type,
    }));

    const body = {
      contact_id: invoice.contact_provider_ref,
      date: invoice.issue_date,
      due_date: invoice.due_date,
      reference: invoice.invoice_number,
      notes: invoice.reference,
      main_address: {},
      invoice_lines: lineItems,
    };

    const response = await client.post('/sales_invoices', { sales_invoice: body });
    return {
      provider_ref: response.data?.id || '',
      provider_data: { displayedAs: response.data?.displayed_as },
    };
  }

  async voidInvoice(
    connection: AccountingConnection,
    providerRef: string,
  ): Promise<void> {
    const client = this.getClient(connection);
    await client.put(`/sales_invoices/${providerRef}`, {
      sales_invoice: { void_reason: 'Booking cancelled in PropertyOS' },
    });
  }

  async recordPayment(
    connection: AccountingConnection,
    payment: AccountingPaymentDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    const invoiceRes = await client.get(`/sales_invoices/${payment.invoice_provider_ref}`);
    const contactId = invoiceRes.data?.contact_id;

    const body = {
      contact_id: contactId,
      transaction_type_id: 'CUSTOMER_RECEIPT',
      date: payment.date,
      total_amount: String(payment.amount),
      reference: payment.reference,
      allocated_artefacts: [
        {
          artefact_id: payment.invoice_provider_ref,
          amount: String(payment.amount),
        },
      ],
    };

    const response = await client.post('/contact_payments', { contact_payment: body });
    return {
      provider_ref: response.data?.id || '',
    };
  }

  async createCreditNote(
    connection: AccountingConnection,
    creditNote: AccountingCreditNoteDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    const lineItems = creditNote.line_items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      ledger_account_id: item.account_code || connection.settings?.default_revenue_account_code,
      tax_rate_id: item.tax_type || connection.settings?.default_tax_type,
    }));

    const body = {
      contact_id: creditNote.contact_provider_ref,
      date: creditNote.date,
      reference: creditNote.reference,
      credit_note_lines: lineItems,
    };

    const response = await client.post('/sales_credit_notes', { sales_credit_note: body });
    return {
      provider_ref: response.data?.id || '',
    };
  }

  async getAccounts(connection: AccountingConnection): Promise<ProviderAccount[]> {
    const client = this.getClient(connection);
    const response = await client.get('/ledger_accounts', {
      params: { items_per_page: 200 },
    });

    const items = response.data?.$items || [];
    return items.map((a: any) => ({
      code: a.nominal_code || '',
      name: a.displayed_as || '',
      type: a.ledger_account_type?.id || '',
      tax_type: a.tax_rate?.id,
    }));
  }

  private getClient(connection: AccountingConnection): AxiosInstance {
    const accessToken = decrypt(connection.access_token_encrypted, this.encryptionKey);
    return this.createClient(accessToken, connection.tenant_id);
  }

  private createClient(accessToken: string, businessId?: string): AxiosInstance {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (businessId) {
      headers['X-Business'] = businessId;
    }
    return axios.create({ baseURL: SAGE_API_BASE, headers });
  }

  private async findContactByEmail(
    client: AxiosInstance,
    email?: string,
  ): Promise<any | null> {
    if (!email) return null;
    try {
      const response = await client.get('/contacts', {
        params: { email, items_per_page: 1 },
      });
      const items = response.data?.$items || [];
      return items.length > 0 ? items[0] : null;
    } catch {
      return null;
    }
  }

  private mapCountry(country?: string): string {
    const map: Record<string, string> = {
      ZA: 'ZA',
      US: 'US',
      GB: 'GB',
    };
    return map[country || 'ZA'] || 'ZA';
  }
}
