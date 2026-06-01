import { ThrottlerModuleOptions } from '@nestjs/throttler';

const isDev = process.env.NODE_ENV !== 'production';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'default', ttl: 60000, limit: isDev ? 600 : 120 },
    { name: 'auth', ttl: 60000, limit: isDev ? 30 : 5 },
    { name: 'public', ttl: 60000, limit: isDev ? 200 : 30 },
    { name: 'admin', ttl: 60000, limit: isDev ? 600 : 100 },
    { name: 'webhooks', ttl: 60000, limit: isDev ? 600 : 200 },
    { name: 'reports', ttl: 60000, limit: isDev ? 60 : 10 },
  ],
};
