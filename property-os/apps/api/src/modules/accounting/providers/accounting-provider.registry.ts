import { Injectable } from '@nestjs/common';
import { IAccountingProvider } from './accounting-provider.interface';
import { XeroProvider } from './xero/xero.provider';
import { SageProvider } from './sage/sage.provider';
import { QuickBooksProvider } from './quickbooks/quickbooks.provider';
import { ZohoProvider } from './zoho/zoho.provider';
import { FreshBooksProvider } from './freshbooks/freshbooks.provider';

@Injectable()
export class AccountingProviderRegistry {
  private readonly providers = new Map<string, IAccountingProvider>();

  constructor(
    private readonly xeroProvider: XeroProvider,
    private readonly sageProvider: SageProvider,
    private readonly quickBooksProvider: QuickBooksProvider,
    private readonly zohoProvider: ZohoProvider,
    private readonly freshBooksProvider: FreshBooksProvider,
  ) {
    this.providers.set(xeroProvider.providerType, xeroProvider);
    this.providers.set(sageProvider.providerType, sageProvider);
    this.providers.set(quickBooksProvider.providerType, quickBooksProvider);
    this.providers.set(zohoProvider.providerType, zohoProvider);
    this.providers.set(freshBooksProvider.providerType, freshBooksProvider);
  }

  get(providerType: string): IAccountingProvider | undefined {
    return this.providers.get(providerType);
  }

  getOrThrow(providerType: string): IAccountingProvider {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Unknown accounting provider: ${providerType}`);
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
