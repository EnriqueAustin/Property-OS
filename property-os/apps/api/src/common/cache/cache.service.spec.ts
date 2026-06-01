import { Test, TestingModule } from '@nestjs/testing';
import { CacheService, REDIS_CLIENT } from './cache.service';

const mockRedis = {
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  quit: jest.fn(),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    // Wait for connect promise
    await new Promise((r) => setTimeout(r, 10));
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed JSON from Redis', async () => {
      mockRedis.get.mockResolvedValue('{"key":"value"}');

      const result = await service.get('test-key');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null when key not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('missing');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set JSON value with TTL', async () => {
      await service.set('key', { data: 'test' }, 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'key',
        '{"data":"test"}',
        'EX',
        60,
      );
    });

    it('should default to 300s TTL', async () => {
      await service.set('key', 'value');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'key',
        '"value"',
        'EX',
        300,
      );
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await service.del('key');
      expect(mockRedis.del).toHaveBeenCalledWith('key');
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.keys.mockResolvedValue(['dash:1', 'dash:2']);

      await service.delPattern('dash:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('dash:*');
      expect(mockRedis.del).toHaveBeenCalledWith('dash:1', 'dash:2');
    });

    it('should not call del when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.delPattern('none:*');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
