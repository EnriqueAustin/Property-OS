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

const FB_AUTH_URL = 'https://auth.freshbooks.com/oauth/authorize';
const FB_TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token';
const FB_API_BASE = 'https://api.freshbooks.com';

@Injectable()
export class FreshBooksProvider implements IAccountingProvider {
  readonly providerType = 'freshbooks';
  private readonly logger = new Logger(FreshBooksProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly encryptionKey: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('FRESHBOOKS_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('FRESHBOOKS_CLIENT_SECRET', '');
    this.encryptionKey = this.config.get<string>('ACCOUNTING_ENCRYPTION_KEY', 'dev-key-change-in-production');
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
    });
    return `${FB_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await axios.post(FB_TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Fetch account/business identity
    let tenantId: string | undefined;
    let organisationName: string | undefined;
    try {
      const meRes = await axios.get(`${FB_API_BASE}/auth/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const biz = meRes.data?.response?.business_memberships?.[0]?.business;
      tenantId = biz?.account_id?.toString();
      organisationName = biz?.name;
    } catch {
      this.logger.warn('Could not fetch FreshBooks identity');
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

    const response = await axios.post(FB_TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: currentRefresh,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

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
    const accountId = connection.tenant_id;

    // Search by email
    if (contact.email) {
      try {
        const searchRes = await client.get(
          `/accounting/account/${accountId}/users/clients`,
          { params: { search: { email: contact.email } } },
        );
        const existing = searchRes.data?.response?.result?.clients?.[0];
        if (existing) {
          return { provider_ref: existing.id.toString() };
        }
      } catch { /* not found */ }
    }

    const body = {
      client: {
        fname: contact.first_name || contact.name,
        lname: contact.last_name || '',
        email: contact.email,
        mob_phone: contact.phone,
        p_street: contact.address,
        p_city: contact.city,
        p_province: contact.province,
        p_code: contact.postal_code,
        p_country: contact.country === 'ZA' ? 'South Africa' : contact.country,
      },
    };

    const response = await client.post(
      `/accounting/account/${accountId}/users/clients`,
      body,
    );
    return {
      provider_ref: response.data?.response?.result?.client?.id?.toString() || '',
      provider_data: { name: `${contact.first_name} ${contact.last_name}` },
    };
  }

  async createInvoice(
    connection: AccountingConnection,
    invoice: AccountingInvoiceDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);
    const accountId = connection.tenant_id;

    const lines = invoice.line_items.map((item) => ({
      name: item.description,
      description: item.description,
      qty: item.quantity,
      unit_cost: { amount: item.unit_price.toFixed(2), code: invoice.currency },
      type: 0, // item type
    }));

    const body = {
      invoice: {
        customerid: parseInt(invoice.contact_provider_ref, 10),
        create_date: invoice.issue_date,
        due_date: invoice.due_date,
        invoice_number: invoice.invoice_number,
        currency_code: invoice.currency,
        notes: invoice.reference,
        lines,
        status: 2, // sent
      },
    };

    const response = await client.post(
      `/accounting/account/${accountId}/invoices/invoices`,
      body,
    );
    const created = response.data?.response?.result?.invoice;
    return {
      provider_ref: created?.id?.toString() || '',
      provider_data: { invoiceNumber: created?.invoice_number },
    };
  }

  async voidInvoice(
    connection: AccountingConnection,
    providerRef: string,
  ): Promise<void> {
    const client = this.getClient(connection);
    const accountId = connection.tenant_id;

    // FreshBooks uses DELETE to void/mark as deleted
    await client.put(
      `/accounting/account/${accountId}/invoices/invoices/${providerRef}`,
      { invoice: { vis_state: 1 } }, // 1 = deleted
    );
  }

  async recordPayment(
    connection: AccountingConnection,
    payment: AccountingPaymentDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);
    const accountId = connection.tenant_id;

    const body = {
      payment: {
        invoiceid: parseInt(payment.invoice_provider_ref, 10),
        amount: { amount: payment.amount.toFixed(2), code: payment.currency },
        date: payment.date,
        note: payment.reference,
        type: 'Cash', // general type
      },
    };

    const response = await client.post(
      `/accounting/account/${accountId}/payments/payments`,
      body,
    );
    return {
      provider_ref: response.data?.response?.result?.payment?.id?.toString() || '',
    };
  }

  async createCreditNote(
    connection: AccountingConnection,
    creditNote: AccountingCreditNoteDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);
    const accountId = connection.tenant_id;

    // FreshBooks doesn't have native credit notes — create a credit invoice (negative amount)
    const lines = creditNote.line_items.map((item) => ({
      name: item.description,
      description: item.description,
      qty: item.quantity,
      unit_cost: { amount: (-item.unit_price).toFixed(2), code: creditNote.currency },
      type: 0,
    }));

    const body = {
      invoice: {
        customerid: parseInt(creditNote.contact_provider_ref, 10),
        create_date: creditNote.date,
        currency_code: creditNote.currency,
        notes: creditNote.reference,
        lines,
        status: 2,
      },
    };

    const response = await client.post(
      `/accounting/account/${accountId}/invoices/invoices`,
      body,
    );
    const created = response.data?.response?.result?.invoice;
    return {
      provider_ref: created?.id?.toString() || '',
    };
  }

  async getAccounts(connection: AccountingConnection): Promise<ProviderAccount[]> {
    // FreshBooks doesn't expose a chart of accounts via API
    // Return a minimal default set for SA hospitality
    return [
      { code: 'revenue', name: 'Revenue', type: 'income' },
      { code: 'accommodation', name: 'Accommodation Revenue', type: 'income' },
      { code: 'other_income', name: 'Other Income', type: 'income' },
    ];
  }

  private getClient(connection: AccountingConnection): AxiosInstance {
    const accessToken = decrypt(connection.access_token_encrypted, this.encryptionKey);
    return axios.create({
      baseURL: FB_API_BASE,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }
}
