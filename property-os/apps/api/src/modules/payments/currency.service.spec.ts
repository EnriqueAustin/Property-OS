import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CurrencyService } from './currency.service';
import { CacheService } from '../../common/cache/cache.service';

const mockConfigService = {
  get: jest.fn().mockReturnValue(null),
};

const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    jest.clearAllMocks();
  });

  describe('getSupportedCurrencies', () => {
    it('should return list of supported currencies', () => {
      const currencies = service.getSupportedCurrencies();

      expect(currencies.length).toBeGreaterThan(0);
      expect(currencies.find((c) => c.code === 'ZAR')).toBeDefined();
      expect(currencies.find((c) => c.code === 'USD')).toBeDefined();
    });
  });

  describe('getCurrencyInfo', () => {
    it('should return info for a valid currency code', () => {
      const info = service.getCurrencyInfo('ZAR');

      expect(info).toBeDefined();
      expect(info!.name).toBe('South African Rand');
      expect(info!.symbol).toBe('R');
      expect(info!.decimals).toBe(2);
    });

    it('should return undefined for unknown currency', () => {
      expect(service.getCurrencyInfo('XXX')).toBeUndefined();
    });
  });

  describe('getExchangeRates', () => {
    it('should return cached rates when available', async () => {
      const cachedRates = { USD: 0.054, EUR: 0.050 };
      mockCacheService.get.mockResolvedValue(cachedRates);

      const result = await service.getExchangeRates('ZAR');

      expect(result).toEqual(cachedRates);
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should return fallback rates when no API key configured', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(null);

      const result = await service.getExchangeRates('ZAR');

      expect(result).toBeDefined();
      expect(result.ZAR).toBe(1);
      expect(result.USD).toBeDefined();
    });

    it('should cache fetched rates', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(null);

      await service.getExchangeRates('ZAR');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('currency:rates'),
        expect.any(Object),
        3600,
      );
    });
  });

  describe('convert', () => {
    it('should return same amount when currencies match', async () => {
      const result = await service.convert(100, 'ZAR', 'ZAR');

      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
    });

    it('should convert between currencies using fallback rates', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(null);

      const result = await service.convert(1000, 'ZAR', 'USD');

      expect(result.amount).toBeGreaterThan(0);
      expect(result.amount).toBeLessThan(1000);
      expect(result.rate).toBeGreaterThan(0);
    });

    it('should throw when target currency has no rate', async () => {
      mockCacheService.get.mockResolvedValue({ USD: 0.054 });

      await expect(service.convert(100, 'ZAR', 'JPY')).rejects.toThrow();
    });
  });

  describe('convertToBase', () => {
    it('should convert to ZAR by default', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(null);

      const result = await service.convertToBase(100, 'ZAR');

      expect(result).toBe(100);
    });
  });

  describe('formatCurrency', () => {
    it('should format with currency symbol', () => {
      const result = service.formatCurrency(1500.5, 'ZAR');

      expect(result).toContain('R');
      expect(result).toContain('1');
      expect(result).toContain('500');
    });

    it('should use code as fallback for unknown currency', () => {
      const result = service.formatCurrency(100, 'XYZ');

      expect(result).toContain('XYZ');
    });
  });
});
