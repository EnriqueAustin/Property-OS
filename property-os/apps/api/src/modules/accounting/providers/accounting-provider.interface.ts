import { AccountingConnection } from '../entities/accounting-connection.entity';

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  tenant_id?: string;
  organisation_name?: string;
}

export interface ProviderRef {
  provider_ref: string;
  provider_data?: Record<string, any>;
}

export interface ProviderAccount {
  code: string;
  name: string;
  type: string;
  tax_type?: string;
}

export interface AccountingContactDto {
  internal_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
}

export interface AccountingInvoiceDto {
  internal_id: string;
  invoice_number: string;
  contact_provider_ref: string;
  issue_date: string;
  due_date: string;
  currency: string;
  line_items: AccountingLineItemDto[];
  subtotal: number;
  tax_amount: number;
  total: number;
  reference?: string;
  tax_type?: string;
  account_code?: string;
}

export interface AccountingLineItemDto {
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  account_code?: string;
  tax_type?: string;
}

export interface AccountingPaymentDto {
  internal_id: string;
  invoice_provider_ref: string;
  amount: number;
  currency: string;
  date: string;
  reference?: string;
  account_code?: string;
}

export interface AccountingCreditNoteDto {
  internal_id: string;
  contact_provider_ref: string;
  date: string;
  currency: string;
  line_items: AccountingLineItemDto[];
  total: number;
  reference?: string;
  tax_type?: string;
  account_code?: string;
}

export interface IAccountingProvider {
  readonly providerType: string;

  getAuthUrl(redirectUri: string, state: string): string;
  handleCallback(
    code: string,
    redirectUri: string,
  ): Promise<TokenSet>;
  refreshToken(connection: AccountingConnection): Promise<TokenSet>;

  upsertContact(
    connection: AccountingConnection,
    contact: AccountingContactDto,
  ): Promise<ProviderRef>;

  createInvoice(
    connection: AccountingConnection,
    invoice: AccountingInvoiceDto,
  ): Promise<ProviderRef>;

  voidInvoice(
    connection: AccountingConnection,
    providerRef: string,
  ): Promise<void>;

  recordPayment(
    connection: AccountingConnection,
    payment: AccountingPaymentDto,
  ): Promise<ProviderRef>;

  createCreditNote(
    connection: AccountingConnection,
    creditNote: AccountingCreditNoteDto,
  ): Promise<ProviderRef>;

  getAccounts(connection: AccountingConnection): Promise<ProviderAccount[]>;
}
