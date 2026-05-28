import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.module';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private connected = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    this.redis
      .connect()
      .then(() => {
        this.connected = true;
        this.logger.log('Redis connected');
      })
      .catch((err) => {
        this.logger.warn(`Redis unavailable, running without cache: ${err.message}`);
      });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;
    try {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!this.connected) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // cache write failure is non-fatal
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.redis.del(key);
    } catch {
      // cache delete failure is non-fatal
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.connected) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // cache delete failure is non-fatal
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.redis.quit();
    }
  }
}
