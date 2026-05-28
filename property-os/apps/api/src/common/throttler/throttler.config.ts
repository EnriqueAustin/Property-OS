import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'auth', ttl: 60000, limit: 5 },
    { name: 'public', ttl: 60000, limit: 30 },
    { name: 'admin', ttl: 60000, limit: 100 },
    { name: 'webhooks', ttl: 60000, limit: 200 },
    { name: 'reports', ttl: 60000, limit: 10 },
  ],
};
