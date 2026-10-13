import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AccountingService } from './accounting.service';
import {
  AccountingConnection,
  AccountingConnectionStatus,
  AccountingProviderType,
} from './entities/accounting-connection.entity';
import { AccountingMapping } from './entities/accounting-mapping.entity';
import { AccountingSyncLog } from './entities/accounting-sync-log.entity';
import { AccountingProviderRegistry } from './providers/accounting-provider.registry';
import { Invoice } from '../payments/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Guest } from '../bookings/entities/guest.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((d) => d),
  save: jest.fn((d) => ({ id: d.id || 'conn-1', ...d })),
});

const mockProvider = {
  getAuthUrl: jest.fn(() => 'https://provider/auth'),
  handleCallback: jest.fn().mockResolvedValue({
    access_token: 'at',
    refresh_token: 'rt',
    expires_at: new Date(Date.now() + 3600_000),
  }),
};

const mockRegistry = { getOrThrow: jest.fn(() => mockProvider) };
const mockConfig = { get: jest.fn(() => 'dev-key') };

describe('AccountingService OAuth state / scoping', () => {
  let service: AccountingService;
  let connectionsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    connectionsRepo = mockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: getRepositoryToken(AccountingConnection), useValue: connectionsRepo },
        { provide: getRepositoryToken(AccountingMapping), useValue: mockRepo() },
        { provide: getRepositoryToken(AccountingSyncLog), useValue: mockRepo() },
        { provide: getRepositoryToken(Invoice), useValue: mockRepo() },
        { provide: getRepositoryToken(Payment), useValue: mockRepo() },
        { provide: getRepositoryToken(Booking), useValue: mockRepo() },
        { provide: getRepositoryToken(Guest), useValue: mockRepo() },
        { provide: AccountingProviderRegistry, useValue: mockRegistry },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AccountingService);
    jest.clearAllMocks();
  });

  function connection(overrides: Partial<AccountingConnection> = {}) {
    return {
      id: 'conn-1',
      property_id: 'prop-1',
      provider_type: AccountingProviderType.XERO,
      status: AccountingConnectionStatus.PENDING,
      oauth_state: 'nonce-abc',
      oauth_state_expires_at: new Date(Date.now() + 10 * 60 * 1000),
      oauth_state_user_id: 'user-1',
      ...overrides,
    } as AccountingConnection;
  }

  it('initiateConnection stores a random state and sends it to the provider', async () => {
    connectionsRepo.findOne.mockResolvedValue(null);
    connectionsRepo.save.mockImplementation((c) => ({ ...c, id: 'conn-1' }));

    await service.initiateConnection(
      'prop-1',
      AccountingProviderType.XERO,
      'http://cb',
      'user-1',
    );

    const saved = connectionsRepo.save.mock.calls[0][0];
    expect(saved.oauth_state).toBeTruthy();
    expect(saved.oauth_state_user_id).toBe('user-1');
    const stateArg = (mockProvider.getAuthUrl.mock.calls[0] as any[])[1];
    expect(stateArg).toBe(`conn-1.${saved.oauth_state}`);
  });

  it('rejects a callback whose state does not match', async () => {
    connectionsRepo.findOne.mockResolvedValue(connection());
    await expect(
      service.handleOAuthCallback('conn-1', 'code', 'http://cb', 'prop-1', 'conn-1.wrong', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(mockProvider.handleCallback).not.toHaveBeenCalled();
  });

  it('rejects a callback with an expired state', async () => {
    connectionsRepo.findOne.mockResolvedValue(
      connection({ oauth_state_expires_at: new Date(Date.now() - 1000) }),
    );
    await expect(
      service.handleOAuthCallback('conn-1', 'code', 'http://cb', 'prop-1', 'conn-1.nonce-abc', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('accepts a matching state, clears it, and exchanges the code', async () => {
    const conn = connection();
    connectionsRepo.findOne.mockResolvedValue(conn);
    connectionsRepo.save.mockImplementation((c) => c);

    await service.handleOAuthCallback(
      'conn-1',
      'code',
      'http://cb',
      'prop-1',
      'conn-1.nonce-abc',
      'user-1',
    );

    expect(conn.oauth_state).toBeNull();
    expect(mockProvider.handleCallback).toHaveBeenCalledWith('code', 'http://cb');
  });

  it('scopes connection lookups by property_id', async () => {
    connectionsRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getConnectionDetail('conn-1', 'other-prop'),
    ).rejects.toThrow(NotFoundException);
    expect(connectionsRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'conn-1', property_id: 'other-prop' },
    });
  });
});
