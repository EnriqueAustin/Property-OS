import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { EmailProvider } from '../notifications/providers/email.provider';

jest.mock('bcrypt');

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  role: 'owner',
  is_active: true,
  google_id: null,
  avatar_url: null,
  password_reset_token: null,
  password_reset_expires: null,
};

const mockUsersRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockRefreshRepo = {
  findOne: jest.fn(),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve(v)),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-refresh-secret'),
};

const mockEmailProvider = {
  send: jest.fn().mockResolvedValue({ success: true, providerRef: 'test' }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailProvider, useValue: mockEmailProvider },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.password_hash).toBeUndefined();
    });

    it('should return null when user not found', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nope@example.com', 'password');
      expect(result).toBeNull();
    });

    it('should return null when password is wrong', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return user info and tokens', async () => {
      mockUsersRepo.update.mockResolvedValue({});

      const result = await service.login(mockUser);

      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.tokens.refreshToken).toBe('mock-token');
      expect(mockUsersRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ last_login_at: expect.any(Date) }));
    });
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const newUser = { ...mockUser, id: 'new-1', email: 'new@example.com' };
      mockUsersRepo.create.mockReturnValue(newUser);
      mockUsersRepo.save.mockResolvedValue(newUser);

      const result = await service.register({
        email: 'new@example.com',
        password: 'Str0ngP@ss',
        first_name: 'Jane',
        last_name: 'Doe',
      });

      expect(result.user.email).toBe('new@example.com');
      expect(result.tokens).toBeDefined();
      expect(bcrypt.hash).toHaveBeenCalledWith('Str0ngP@ss', 12);
    });

    it('should throw ConflictException when email exists', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Str0ngP@ss',
          first_name: 'John',
          last_name: 'Doe',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('refreshTokens', () => {
    const hashOf = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

    const validRow = () => ({
      id: 'jti-1',
      user_id: 'user-1',
      family_id: 'fam-1',
      token_hash: hashOf('valid-refresh'),
      expires_at: new Date(Date.now() + 3600_000),
      revoked_at: null,
      replaced_by: null,
    });

    it('should return new tokens for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1', family: 'fam-1' });
      mockRefreshRepo.findOne.mockResolvedValue(validRow());
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.refreshTokens('valid-refresh');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      // old row rotated (revoked)
      expect(mockRefreshRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'jti-1', revoked_at: expect.any(Date) }),
      );
    });

    it('should throw when refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke the family and throw on reuse of a revoked token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1', family: 'fam-1' });
      mockRefreshRepo.findOne.mockResolvedValue({ ...validRow(), revoked_at: new Date() });

      await expect(service.refreshTokens('valid-refresh')).rejects.toThrow(UnauthorizedException);
      expect(mockRefreshRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ family_id: 'fam-1' }),
        expect.objectContaining({ revoked_at: expect.any(Date) }),
      );
    });

    it('should throw when user is inactive', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1', family: 'fam-1' });
      mockRefreshRepo.findOne.mockResolvedValue(validRow());
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, is_active: false });

      await expect(service.refreshTokens('valid-refresh')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findOrCreateGoogleUser', () => {
    const googleProfile = {
      googleId: 'google-123',
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
      avatar: 'https://example.com/avatar.jpg',
    };

    it('should return existing user found by google_id', async () => {
      mockUsersRepo.findOne.mockResolvedValueOnce(mockUser);
      mockUsersRepo.update.mockResolvedValue({});

      const result = await service.findOrCreateGoogleUser(googleProfile);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
    });

    it('should link google_id to existing email user', async () => {
      mockUsersRepo.findOne
        .mockResolvedValueOnce(null) // no google_id match
        .mockResolvedValueOnce({ ...mockUser, google_id: null }); // email match
      mockUsersRepo.save.mockResolvedValue({ ...mockUser, google_id: 'google-123' });
      mockUsersRepo.update.mockResolvedValue({});

      const result = await service.findOrCreateGoogleUser(googleProfile);

      expect(result.user).toBeDefined();
      expect(mockUsersRepo.save).toHaveBeenCalled();
    });

    it('should create new user when no match found', async () => {
      mockUsersRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const newUser = { ...mockUser, id: 'google-user-1', google_id: 'google-123' };
      mockUsersRepo.create.mockReturnValue(newUser);
      mockUsersRepo.save.mockResolvedValue(newUser);
      mockUsersRepo.update.mockResolvedValue({});

      const result = await service.findOrCreateGoogleUser(googleProfile);

      expect(result.user).toBeDefined();
      expect(mockUsersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          google_id: 'google-123',
          email_verified: true,
        }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('should return same message whether or not email exists', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');
      expect(result.message).toContain('reset link has been sent');
    });
  });

  describe('forgotPassword', () => {
    it('should send a reset email and not log the raw token', async () => {
      const user = { ...mockUser };
      mockUsersRepo.findOne.mockResolvedValue(user);
      mockUsersRepo.save.mockResolvedValue(user);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('reset link has been sent');
      expect(mockEmailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@example.com' }),
      );
      // A hash is stored, not the raw token
      expect(user.password_reset_token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('resetPassword', () => {
    it('should throw when token is invalid', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('should reset password and revoke sessions when token is valid', async () => {
      const userWithToken = {
        ...mockUser,
        password_reset_token: 'hashed-token',
        password_reset_expires: new Date(Date.now() + 3600_000),
      };
      mockUsersRepo.findOne.mockResolvedValue(userWithToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pass');
      mockUsersRepo.save.mockResolvedValue(userWithToken);

      const result = await service.resetPassword('valid-token', 'NewP@ss123');

      expect(result.message).toContain('reset successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewP@ss123', 12);
      // all refresh sessions revoked
      expect(mockRefreshRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1' }),
        expect.objectContaining({ revoked_at: expect.any(Date) }),
      );
    });
  });
});
