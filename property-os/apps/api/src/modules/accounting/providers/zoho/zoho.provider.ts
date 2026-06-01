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

// Zoho uses region-specific domains; .com is default, SA users typically on .com
const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_API_BASE = 'https://www.zohoapis.com/books/v3';

const SCOPES = [
  'ZohoBooks.invoices.CREATE',
  'ZohoBooks.invoices.UPDATE',
  'ZohoBooks.invoices.READ',
  'ZohoBooks.contacts.CREATE',
  'ZohoBooks.contacts.UPDATE',
  'ZohoBooks.contacts.READ',
  'ZohoBooks.customerpayments.CREATE',
  'ZohoBooks.customerpayments.READ',
  'ZohoBooks.creditnotes.CREATE',
  'ZohoBooks.creditnotes.READ',
  'ZohoBooks.chartofaccounts.READ',
  'ZohoBooks.settings.READ',
].join(',');

@Injectable()
export class ZohoProvider implements IAccountingProvider {
  readonly providerType = 'zoho';
  private readonly logger = new Logger(ZohoProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly encryptionKey: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('ZOHO_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('ZOHO_CLIENT_SECRET', '');
    this.encryptionKey = this.config.get<string>('ACCOUNTING_ENCRYPTION_KEY', 'dev-key-change-in-production');
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${ZOHO_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await axios.post(
      ZOHO_TOKEN_URL,
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

    // Fetch organisation ID (tenant)
    let tenantId: string | undefined;
    let organisationName: string | undefined;
    try {
      const orgRes = await axios.get(`${ZOHO_API_BASE}/organizations`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const org = orgRes.data?.organizations?.[0];
      tenantId = org?.organization_id;
      organisationName = org?.name;
    } catch {
      this.logger.warn('Could not fetch Zoho organization info');
    }

    return {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + (expires_in || 3600) * 1000),
      tenant_id: tenantId,
      organisation_name: organisationName,
    };
  }

  async refreshToken(connection: AccountingConnection): Promise<TokenSet> {
    const currentRefresh = decrypt(connection.refresh_token_encrypted, this.encryptionKey);

    const response = await axios.post(
      ZOHO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefresh,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const { access_token, expires_in } = response.data;
    // Zoho refresh tokens don't rotate — reuse existing
    return {
      access_token,
      refresh_token: currentRefresh,
      expires_at: new Date(Date.now() + (expires_in || 3600) * 1000),
      tenant_id: connection.tenant_id,
    };
  }

  async upsertContact(
    connection: AccountingConnection,
    contact: AccountingContactDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    // Search by email
    if (contact.email) {
      try {
        const searchRes = await client.get('/contacts', {
          params: { email: contact.email },
        });
        const existing = searchRes.data?.contacts?.[0];
        if (existing) {
          return { provider_ref: existing.contact_id };
        }
      } catch { /* not found, create new */ }
    }

    const body = {
      contact_name: contact.name,
      contact_type: 'customer',
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      billing_address: contact.address
        ? {
            address: contact.address,
            city: contact.city,
            state: contact.province,
            zip: contact.postal_code,
            country: contact.country === 'ZA' ? 'South Africa' : contact.country,
          }
        : undefined,
    };

    const response = await client.post('/contacts', { JSONString: JSON.stringify(body) });
    return {
      provider_ref: response.data?.contact?.contact_id || '',
      provider_data: { name: response.data?.contact?.contact_name },
    };
  }

  async createInvoice(
    connection: AccountingConnection,
    invoice: AccountingInvoiceDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    const lineItems = invoice.line_items.map((item) => ({
      name: item.description,
      description: item.description,
      quantity: item.quantity,
      rate: item.unit_price,
      account_id: item.account_code || connection.settings?.default_revenue_account_code,
      tax_id: item.tax_type || connection.settings?.default_tax_type,
    }));

    const body = {
      customer_id: invoice.contact_provider_ref,
      invoice_number: invoice.invoice_number,
      date: invoice.issue_date,
      due_date: invoice.due_date,
      currency_code: invoice.currency,
      reference_number: invoice.reference,
      line_items: lineItems,
      is_inclusive_tax: true,
    };

    const response = await client.post('/invoices', { JSONString: JSON.stringify(body) });
    return {
      provider_ref: response.data?.invoice?.invoice_id || '',
      provider_data: { invoiceNumber: response.data?.invoice?.invoice_number },
    };
  }

  async voidInvoice(
    connection: AccountingConnection,
    providerRef: string,
  ): Promise<void> {
    const client = this.getClient(connection);
    await client.post(`/invoices/${providerRef}/status/void`);
  }

  async recordPayment(
    connection: AccountingConnection,
    payment: AccountingPaymentDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    // Get invoice to find customer
    const invoiceRes = await client.get(`/invoices/${payment.invoice_provider_ref}`);
    const invoice = invoiceRes.data?.invoice;

    const body = {
      customer_id: invoice?.customer_id,
      payment_mode: 'Bank Transfer',
      amount: payment.amount,
      date: payment.date,
      reference_number: payment.reference,
      invoices: [
        {
          invoice_id: payment.invoice_provider_ref,
          amount_applied: payment.amount,
        },
      ],
    };

    const response = await client.post('/customerpayments', { JSONString: JSON.stringify(body) });
    return {
      provider_ref: response.data?.payment?.payment_id || '',
    };
  }

  async createCreditNote(
    connection: AccountingConnection,
    creditNote: AccountingCreditNoteDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);

    const lineItems = creditNote.line_items.map((item) => ({
      name: item.description,
      description: item.description,
      quantity: item.quantity,
      rate: item.unit_price,
      account_id: item.account_code || connection.settings?.default_revenue_account_code,
    }));

    const body = {
      customer_id: creditNote.contact_provider_ref,
      creditnote_number: creditNote.reference,
      date: creditNote.date,
      currency_code: creditNote.currency,
      line_items: lineItems,
      is_inclusive_tax: true,
    };

    const response = await client.post('/creditnotes', { JSONString: JSON.stringify(body) });
    return {
      provider_ref: response.data?.creditnote?.creditnote_id || '',
    };
  }

  async getAccounts(connection: AccountingConnection): Promise<ProviderAccount[]> {
    const client = this.getClient(connection);
    const response = await client.get('/chartofaccounts');

    const accounts = response.data?.chartofaccounts || [];
    return accounts.map((a: any) => ({
      code: a.account_code || a.account_id,
      name: a.account_name || '',
      type: a.account_type || '',
      tax_type: a.tax_id,
    }));
  }

  private getClient(connection: AccountingConnection): AxiosInstance {
    const accessToken = decrypt(connection.access_token_encrypted, this.encryptionKey);
    return axios.create({
      baseURL: ZOHO_API_BASE,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        organization_id: connection.tenant_id,
      },
    });
  }
}
