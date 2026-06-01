import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountingApi,
  Contact,
  Contacts,
  Invoice,
  Invoices,
  LineItem,
  Payment,
  Payments,
  CreditNote,
  CreditNotes,
  Account,
  Phone,
  Address,
  CurrencyCode,
  LineAmountTypes,
} from 'xero-node';
import axios from 'axios';
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

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.transactions',
  'accounting.contacts',
  'accounting.settings.read',
].join(' ');

@Injectable()
export class XeroProvider implements IAccountingProvider {
  readonly providerType = 'xero';
  private readonly logger = new Logger(XeroProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly encryptionKey: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('XERO_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('XERO_CLIENT_SECRET', '');
    this.encryptionKey = this.config.get<string>('ACCOUNTING_ENCRYPTION_KEY', 'dev-key-change-in-production');
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
    });
    return `${XERO_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await axios.post(
      XERO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;

    const connectionsRes = await axios.get(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const connection = connectionsRes.data[0];

    return {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
      tenant_id: connection?.tenantId,
      organisation_name: connection?.tenantName,
    };
  }

  async refreshToken(connection: AccountingConnection): Promise<TokenSet> {
    const currentRefresh = decrypt(connection.refresh_token_encrypted, this.encryptionKey);

    const response = await axios.post(
      XERO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefresh,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
      },
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
    const api = this.getApi(connection);
    const tenantId = connection.tenant_id;

    const xeroContact: Contact = {
      name: contact.name,
      firstName: contact.first_name,
      lastName: contact.last_name,
      emailAddress: contact.email,
      phones: contact.phone
        ? [{ phoneType: Phone.PhoneTypeEnum.DEFAULT, phoneNumber: contact.phone }]
        : [],
      addresses: contact.address
        ? [{
            addressType: Address.AddressTypeEnum.STREET,
            addressLine1: contact.address,
            city: contact.city,
            region: contact.province,
            postalCode: contact.postal_code,
            country: contact.country,
          }]
        : [],
    };

    const body: Contacts = { contacts: [xeroContact] };
    const response = await api.updateOrCreateContacts(tenantId, body);
    const created = response.body.contacts?.[0];

    return {
      provider_ref: created?.contactID || '',
      provider_data: { name: created?.name },
    };
  }

  async createInvoice(
    connection: AccountingConnection,
    invoice: AccountingInvoiceDto,
  ): Promise<ProviderRef> {
    const api = this.getApi(connection);
    const tenantId = connection.tenant_id;

    const lineItems: LineItem[] = invoice.line_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unit_price,
      accountCode: item.account_code || connection.settings?.default_revenue_account_code || '200',
      taxType: item.tax_type || connection.settings?.default_tax_type || 'OUTPUT',
    }));

    const xeroInvoice: Invoice = {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: invoice.contact_provider_ref },
      lineItems,
      date: invoice.issue_date,
      dueDate: invoice.due_date,
      invoiceNumber: invoice.invoice_number,
      reference: invoice.reference,
      currencyCode: this.mapCurrency(invoice.currency),
      status: Invoice.StatusEnum.AUTHORISED,
      lineAmountTypes: LineAmountTypes.Inclusive,
    };

    const body: Invoices = { invoices: [xeroInvoice] };
    const response = await api.createInvoices(tenantId, body, false);
    const created = response.body.invoices?.[0];

    return {
      provider_ref: created?.invoiceID || '',
      provider_data: { invoiceNumber: created?.invoiceNumber },
    };
  }

  async voidInvoice(
    connection: AccountingConnection,
    providerRef: string,
  ): Promise<void> {
    const api = this.getApi(connection);
    const tenantId = connection.tenant_id;

    const body: Invoices = {
      invoices: [{
        invoiceID: providerRef,
        status: Invoice.StatusEnum.VOIDED,
      }],
    };
    await api.updateInvoice(tenantId, providerRef, body);
  }

  async recordPayment(
    connection: AccountingConnection,
    payment: AccountingPaymentDto,
  ): Promise<ProviderRef> {
    const api = this.getApi(connection);
    const tenantId = connection.tenant_id;

    const xeroPayment: Payment = {
      invoice: { invoiceID: payment.invoice_provider_ref },
      amount: payment.amount,
      date: payment.date,
      reference: payment.reference,
      currencyRate: 1,
    };

    if (payment.account_code) {
      xeroPayment.account = { code: payment.account_code };
    }

    const body: Payments = { payments: [xeroPayment] };
    const response = await api.createPayments(tenantId, body);
    const created = response.body.payments?.[0];

    return {
      provider_ref: created?.paymentID || '',
    };
  }

  async createCreditNote(
    connection: AccountingConnection,
    creditNote: AccountingCreditNoteDto,
  ): Promise<ProviderRef> {
    const api = this.getApi(connection);
    const tenantId = connection.tenant_id;

    const lineItems: LineItem[] = creditNote.line_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unit_price,
      accountCode: item.account_code || connection.settings?.default_revenue_account_code || '200',
      taxType: item.tax_type || connection.settings?.default_tax_type || 'OUTPUT',
    }));

    const xeroCreditNote: CreditNote = {
      type: CreditNote.TypeEnum.ACCRECCREDIT,
      contact: { contactID: creditNote.contact_provider_ref },
      lineItems,
      date: creditNote.date,
      reference: creditNote.reference,
      currencyCode: this.mapCurrency(creditNote.currency),
      status: CreditNote.StatusEnum.AUTHORISED,
      lineAmountTypes: LineAmountTypes.Inclusive,
    };

    const body: CreditNotes = { creditNotes: [xeroCreditNote] };
    const response = await api.createCreditNotes(tenantId, body);
    const created = response.body.creditNotes?.[0];

    return {
      provider_ref: created?.creditNoteID || '',
    };
  }

  async getAccounts(connection: AccountingConnection): Promise<ProviderAccount[]> {
    const api = this.getApi(connection);
    const tenantId = connection.tenant_id;

    const response = await api.getAccounts(tenantId);
    const accounts = response.body.accounts || [];

    return accounts.map((a: Account) => ({
      code: a.code || '',
      name: a.name || '',
      type: a.type?.toString() || '',
      tax_type: a.taxType,
    }));
  }

  private getApi(connection: AccountingConnection): AccountingApi {
    const accessToken = decrypt(connection.access_token_encrypted, this.encryptionKey);
    const api = new AccountingApi();
    api.accessToken = accessToken;
    return api;
  }

  private mapCurrency(currency: string): CurrencyCode {
    const map: Record<string, CurrencyCode> = {
      ZAR: CurrencyCode.ZAR,
      USD: CurrencyCode.USD,
      EUR: CurrencyCode.EUR,
      GBP: CurrencyCode.GBP,
    };
    return map[currency] || CurrencyCode.ZAR;
  }
}
