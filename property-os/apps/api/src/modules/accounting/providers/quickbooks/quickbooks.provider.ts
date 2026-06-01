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

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3';
const QBO_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3';

const SCOPES = 'com.intuit.quickbooks.accounting';

@Injectable()
export class QuickBooksProvider implements IAccountingProvider {
  readonly providerType = 'quickbooks';
  private readonly logger = new Logger(QuickBooksProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly encryptionKey: string;
  private readonly sandbox: boolean;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('QBO_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('QBO_CLIENT_SECRET', '');
    this.encryptionKey = this.config.get<string>('ACCOUNTING_ENCRYPTION_KEY', 'dev-key-change-in-production');
    this.sandbox = this.config.get<string>('QBO_SANDBOX', 'true') === 'true';
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
    });
    return `${QBO_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await axios.post(
      QBO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          Accept: 'application/json',
        },
      },
    );

    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = response.data;

    // realmId is passed as a query param in the redirect — stored as tenant_id
    // The caller extracts it from the callback URL query params
    return {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
    };
  }

  async refreshToken(connection: AccountingConnection): Promise<TokenSet> {
    const currentRefresh = decrypt(connection.refresh_token_encrypted, this.encryptionKey);

    const response = await axios.post(
      QBO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefresh,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          Accept: 'application/json',
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
    const client = this.getClient(connection);
    const realmId = connection.tenant_id;

    // Search for existing customer by email
    if (contact.email) {
      const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${contact.email.replace(/'/g, "\\'")}'`;
      const searchRes = await client.get(`/company/${realmId}/query`, {
        params: { query },
      });
      const existing = searchRes.data?.QueryResponse?.Customer?.[0];
      if (existing) {
        return { provider_ref: existing.Id };
      }
    }

    const body = {
      DisplayName: contact.name,
      GivenName: contact.first_name,
      FamilyName: contact.last_name,
      PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
      PrimaryPhone: contact.phone ? { FreeFormNumber: contact.phone } : undefined,
      BillAddr: contact.address
        ? {
            Line1: contact.address,
            City: contact.city,
            CountrySubDivisionCode: contact.province,
            PostalCode: contact.postal_code,
            Country: contact.country,
          }
        : undefined,
    };

    const response = await client.post(`/company/${realmId}/customer`, body);
    return {
      provider_ref: response.data?.Customer?.Id || '',
      provider_data: { displayName: response.data?.Customer?.DisplayName },
    };
  }

  async createInvoice(
    connection: AccountingConnection,
    invoice: AccountingInvoiceDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);
    const realmId = connection.tenant_id;

    const lines = invoice.line_items.map((item, idx) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: item.quantity * item.unit_price,
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price,
        ItemRef: undefined,
      },
      LineNum: idx + 1,
    }));

    const body = {
      CustomerRef: { value: invoice.contact_provider_ref },
      Line: lines,
      DocNumber: invoice.invoice_number,
      TxnDate: invoice.issue_date,
      DueDate: invoice.due_date,
      CurrencyRef: { value: invoice.currency },
      PrivateNote: invoice.reference,
    };

    const response = await client.post(`/company/${realmId}/invoice`, body);
    return {
      provider_ref: response.data?.Invoice?.Id || '',
      provider_data: { docNumber: response.data?.Invoice?.DocNumber },
    };
  }

  async voidInvoice(
    connection: AccountingConnection,
    providerRef: string,
  ): Promise<void> {
    const client = this.getClient(connection);
    const realmId = connection.tenant_id;

    // QBO requires the full invoice object with SyncToken to void
    const getRes = await client.get(`/company/${realmId}/invoice/${providerRef}`);
    const invoice = getRes.data?.Invoice;
    if (!invoice) return;

    await client.post(`/company/${realmId}/invoice`, {
      Id: invoice.Id,
      SyncToken: invoice.SyncToken,
      sparse: true,
    }, {
      params: { operation: 'void' },
    });
  }

  async recordPayment(
    connection: AccountingConnection,
    payment: AccountingPaymentDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);
    const realmId = connection.tenant_id;

    // Get invoice to find customer ref
    const invoiceRes = await client.get(`/company/${realmId}/invoice/${payment.invoice_provider_ref}`);
    const invoice = invoiceRes.data?.Invoice;

    const body = {
      CustomerRef: invoice?.CustomerRef,
      TotalAmt: payment.amount,
      TxnDate: payment.date,
      Line: [
        {
          Amount: payment.amount,
          LinkedTxn: [
            {
              TxnId: payment.invoice_provider_ref,
              TxnType: 'Invoice',
            },
          ],
        },
      ],
      CurrencyRef: { value: payment.currency },
      PrivateNote: payment.reference,
    };

    const response = await client.post(`/company/${realmId}/payment`, body);
    return {
      provider_ref: response.data?.Payment?.Id || '',
    };
  }

  async createCreditNote(
    connection: AccountingConnection,
    creditNote: AccountingCreditNoteDto,
  ): Promise<ProviderRef> {
    const client = this.getClient(connection);
    const realmId = connection.tenant_id;

    const lines = creditNote.line_items.map((item, idx) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: item.quantity * item.unit_price,
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price,
      },
      LineNum: idx + 1,
    }));

    const body = {
      CustomerRef: { value: creditNote.contact_provider_ref },
      Line: lines,
      TxnDate: creditNote.date,
      PrivateNote: creditNote.reference,
      CurrencyRef: { value: creditNote.currency },
    };

    const response = await client.post(`/company/${realmId}/creditmemo`, body);
    return {
      provider_ref: response.data?.CreditMemo?.Id || '',
    };
  }

  async getAccounts(connection: AccountingConnection): Promise<ProviderAccount[]> {
    const client = this.getClient(connection);
    const realmId = connection.tenant_id;

    const query = 'SELECT * FROM Account MAXRESULTS 200';
    const response = await client.get(`/company/${realmId}/query`, {
      params: { query },
    });

    const accounts = response.data?.QueryResponse?.Account || [];
    return accounts.map((a: any) => ({
      code: a.AcctNum || a.Id,
      name: a.Name || '',
      type: a.AccountType || '',
      tax_type: a.TaxCodeRef?.value,
    }));
  }

  private getClient(connection: AccountingConnection): AxiosInstance {
    const accessToken = decrypt(connection.access_token_encrypted, this.encryptionKey);
    const baseURL = this.sandbox ? QBO_SANDBOX_API_BASE : QBO_API_BASE;
    return axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }
}
