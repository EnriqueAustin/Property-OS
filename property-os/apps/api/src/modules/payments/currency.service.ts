import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache/cache.service';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P', decimals: 2 },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', decimals: 2 },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', decimals: 2 },
];

const FALLBACK_RATES: Record<string, number> = {
  ZAR: 1,
  USD: 0.054,
  EUR: 0.050,
  GBP: 0.043,
  BWP: 0.74,
  MZN: 3.44,
  NAD: 1.0,
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly CACHE_KEY = 'currency:rates';
  private readonly CACHE_TTL = 3600;

  constructor(
    private config: ConfigService,
    private cache: CacheService,
  ) {}

  getSupportedCurrencies(): CurrencyInfo[] {
    return SUPPORTED_CURRENCIES;
  }

  getCurrencyInfo(code: string): CurrencyInfo | undefined {
    return SUPPORTED_CURRENCIES.find((c) => c.code === code);
  }

  async getExchangeRates(baseCurrency = 'ZAR'): Promise<Record<string, number>> {
    const cacheKey = `${this.CACHE_KEY}:${baseCurrency}`;
    const cached = await this.cache.get<Record<string, number>>(cacheKey);
    if (cached) return cached;

    try {
      const rates = await this.fetchRatesFromApi(baseCurrency);
      await this.cache.set(cacheKey, rates, this.CACHE_TTL);
      return rates;
    } catch (err) {
      this.logger.warn(`Failed to fetch exchange rates, using fallback: ${err}`);
      return this.getFallbackRates(baseCurrency);
    }
  }

  async convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number }> {
    if (from === to) return { amount, rate: 1 };

    const rates = await this.getExchangeRates(from);
    const rate = rates[to];
    if (!rate) {
      throw new Error(`No exchange rate available for ${from} to ${to}`);
    }

    return {
      amount: Math.round(amount * rate * 100) / 100,
      rate,
    };
  }

  async convertToBase(amount: number, fromCurrency: string, baseCurrency = 'ZAR'): Promise<number> {
    const result = await this.convert(amount, fromCurrency, baseCurrency);
    return result.amount;
  }

  formatCurrency(amount: number, currencyCode: string): string {
    const info = this.getCurrencyInfo(currencyCode);
    const symbol = info?.symbol || currencyCode;
    return `${symbol} ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private async fetchRatesFromApi(baseCurrency: string): Promise<Record<string, number>> {
    const apiKey = this.config.get<string>('EXCHANGE_RATE_API_KEY');
    if (!apiKey) {
      return this.getFallbackRates(baseCurrency);
    }

    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`,
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json();
    const rates: Record<string, number> = {};
    for (const currency of SUPPORTED_CURRENCIES) {
      if (data.conversion_rates?.[currency.code]) {
        rates[currency.code] = data.conversion_rates[currency.code];
      }
    }
    return rates;
  }

  private getFallbackRates(baseCurrency: string): Record<string, number> {
    const baseRate = FALLBACK_RATES[baseCurrency] || 1;
    const rates: Record<string, number> = {};
    for (const [code, rate] of Object.entries(FALLBACK_RATES)) {
      rates[code] = Math.round((rate / baseRate) * 10000) / 10000;
    }
    return rates;
  }
}
