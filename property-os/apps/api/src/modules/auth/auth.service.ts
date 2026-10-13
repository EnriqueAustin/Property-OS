import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { EmailProvider } from '../notifications/providers/email.provider';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 3 days
const GOOGLE_CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Short-lived one-time codes for the Google OAuth redirect → POST exchange.
  // NOTE: in-memory only; see follow-ups for a multi-instance-safe store.
  private readonly googleCodes = new Map<string, { tokens: Tokens; expires: number }>();

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokensRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailProvider: EmailProvider,
  ) {}

  private normalizeEmail(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
    if (user && user.password_hash && (await bcrypt.compare(pass, user.password_hash))) {
      const { password_hash, password_reset_token, password_reset_expires, invite_token, invite_expires, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const tokens = await this.issueTokens(user);

    await this.usersRepository.update(user.id, { last_login_at: new Date() });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<Tokens> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload?.jti || !payload?.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const row = await this.refreshTokensRepository.findOne({
      where: { id: payload.jti },
    });
    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: a revoked token being presented means the chain leaked.
    if (row.revoked_at) {
      await this.revokeFamily(row.family_id);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (row.token_hash !== this.sha256(refreshToken)) {
      // Token id matched but secret didn't — treat as compromise.
      await this.revokeFamily(row.family_id);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate within the same family.
    const next = await this.createSession(user, row.family_id);
    row.revoked_at = new Date();
    row.replaced_by = next.jti;
    await this.refreshTokensRepository.save(row);

    return next.tokens;
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    if (refreshToken) {
      try {
        const payload: any = this.jwtService.verify(refreshToken, {
          secret: this.getRefreshSecret(),
        });
        if (payload?.jti) {
          const row = await this.refreshTokensRepository.findOne({
            where: { id: payload.jti },
          });
          if (row && !row.revoked_at) {
            await this.revokeFamily(row.family_id);
          }
        }
      } catch {
        // Ignore invalid tokens — logout is idempotent.
      }
    }
    return { message: 'Logged out' };
  }

  async getUser(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException('User not found');
    const { password_hash, password_reset_token, password_reset_expires, invite_token, invite_expires, ...result } = user;
    return result;
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepository.create({
      email,
      password_hash: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
    });
    const saved = await this.usersRepository.save(user);

    const tokens = await this.issueTokens(saved);

    return {
      user: {
        id: saved.id,
        email: saved.email,
        firstName: saved.first_name,
        lastName: saved.last_name,
      },
      tokens,
    };
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }) {
    const email = this.normalizeEmail(profile.email);
    let user = await this.usersRepository.findOne({
      where: { google_id: profile.googleId },
    });

    if (!user) {
      user = await this.usersRepository.findOne({ where: { email } });

      if (user) {
        user.google_id = profile.googleId;
        if (!user.avatar_url && profile.avatar) user.avatar_url = profile.avatar;
        await this.usersRepository.save(user);
      } else {
        user = this.usersRepository.create({
          email,
          first_name: profile.firstName,
          last_name: profile.lastName,
          google_id: profile.googleId,
          avatar_url: profile.avatar,
          email_verified: true,
          password_hash: null as any,
        });
        user = await this.usersRepository.save(user);
      }
    }

    return this.login(user);
  }

  /**
   * Store the Google login result behind a short-lived one-time code so the
   * browser redirect carries only an opaque code (not tokens) in its URL.
   */
  createGoogleExchangeCode(tokens: Tokens): string {
    this.pruneGoogleCodes();
    const code = crypto.randomBytes(32).toString('hex');
    this.googleCodes.set(code, { tokens, expires: Date.now() + GOOGLE_CODE_TTL_MS });
    return code;
  }

  exchangeGoogleCode(code: string): Tokens {
    this.pruneGoogleCodes();
    const entry = code ? this.googleCodes.get(code) : undefined;
    if (!entry || entry.expires < Date.now()) {
      throw new BadRequestException('Invalid or expired code');
    }
    this.googleCodes.delete(code);
    return entry.tokens;
  }

  private pruneGoogleCodes() {
    const now = Date.now();
    for (const [code, entry] of this.googleCodes) {
      if (entry.expires < now) this.googleCodes.delete(code);
    }
  }

  async forgotPassword(email: string) {
    const normalized = this.normalizeEmail(email);
    const user = await this.usersRepository.findOne({ where: { email: normalized } });
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If that email is registered, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = this.sha256(token);
    user.password_reset_expires = new Date(Date.now() + RESET_TTL_MS);
    await this.usersRepository.save(user);

    const link = `${this.getFrontendUrl()}/reset-password?token=${token}`;
    await this.sendMail(
      user.email,
      'Reset your PropertyOS password',
      this.resetPasswordEmail(user.first_name, link),
    );

    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashed = this.sha256(token ?? '');
    const user = await this.usersRepository.findOne({
      where: { password_reset_token: hashed },
    });

    if (!user || !user.password_reset_expires || user.password_reset_expires.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password_hash = await bcrypt.hash(newPassword, 12);
    user.password_reset_token = null as any;
    user.password_reset_expires = null as any;
    await this.usersRepository.save(user);

    // Kill all existing sessions after a credential change.
    await this.revokeAllForUser(user.id);

    return { message: 'Password has been reset successfully' };
  }

  async acceptInvite(token: string, password: string) {
    const hashed = this.sha256(token ?? '');
    const user = await this.usersRepository.findOne({
      where: { invite_token: hashed },
    });

    if (!user || !user.invite_expires || user.invite_expires.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired invite token');
    }

    user.password_hash = await bcrypt.hash(password, 12);
    user.invite_token = null as any;
    user.invite_expires = null as any;
    user.email_verified = true;
    user.is_active = true;
    await this.usersRepository.save(user);

    return this.login(user);
  }

  // -- Token/session helpers --------------------------------------------------

  private async issueTokens(user: { id: string; email: string; role: string }): Promise<Tokens> {
    const family = crypto.randomUUID();
    const { tokens } = await this.createSession(user, family);
    return tokens;
  }

  private async createSession(
    user: { id: string; email: string; role: string },
    familyId: string,
  ): Promise<{ tokens: Tokens; jti: string }> {
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign({
      email: user.email,
      sub: user.id,
      role: user.role,
    });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti, family: familyId },
      { secret: this.getRefreshSecret(), expiresIn: '7d' },
    );

    const row = this.refreshTokensRepository.create({
      id: jti,
      user_id: user.id,
      family_id: familyId,
      token_hash: this.sha256(refreshToken),
      expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      revoked_at: null,
      replaced_by: null,
    });
    await this.refreshTokensRepository.save(row);

    return { tokens: { accessToken, refreshToken, expiresIn: 900 }, jti };
  }

  private async revokeFamily(familyId: string) {
    await this.refreshTokensRepository.update(
      { family_id: familyId, revoked_at: null as any },
      { revoked_at: new Date() },
    );
  }

  private async revokeAllForUser(userId: string) {
    await this.refreshTokensRepository.update(
      { user_id: userId, revoked_at: null as any },
      { revoked_at: new Date() },
    );
  }

  /** Housekeeping: drop refresh rows that expired long ago (best-effort). */
  async purgeExpiredRefreshTokens() {
    await this.refreshTokensRepository.delete({
      expires_at: LessThan(new Date(Date.now() - REFRESH_TTL_MS)),
    });
  }

  private getRefreshSecret(): string {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_REFRESH_SECRET must be set in production');
      }
      return 'dev-refresh-secret';
    }
    return secret;
  }

  private getFrontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      const result = await this.emailProvider.send({ to, subject, html });
      if (!result.success) {
        this.logger.warn(`Auth email to ${to} not sent: ${result.error}`);
      }
    } catch (err: any) {
      this.logger.error(`Auth email to ${to} failed: ${err.message}`);
    }
  }

  private resetPasswordEmail(firstName: string, link: string): string {
    const name = firstName ? firstName : 'there';
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin:0 0 16px;">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your PropertyOS password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;">Reset password</a>
        </p>
        <p style="color:#475569;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
  }
}
