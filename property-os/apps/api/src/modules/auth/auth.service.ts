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
import { MoreThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      const { password_hash, password_reset_token, password_reset_expires, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const tokens = this.generateTokens(payload);

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

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user || !user.is_active) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const newPayload = { email: user.email, sub: user.id, role: user.role };
      return this.generateTokens(newPayload);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getUser(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException('User not found');
    const { password_hash, password_reset_token, password_reset_expires, ...result } = user;
    return result;
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepository.create({
      email: dto.email,
      password_hash: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
    });
    const saved = await this.usersRepository.save(user);

    const payload = { email: saved.email, sub: saved.id, role: saved.role };
    const tokens = this.generateTokens(payload);

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
    let user = await this.usersRepository.findOne({
      where: { google_id: profile.googleId },
    });

    if (!user) {
      user = await this.usersRepository.findOne({
        where: { email: profile.email },
      });

      if (user) {
        user.google_id = profile.googleId;
        if (!user.avatar_url && profile.avatar) user.avatar_url = profile.avatar;
        await this.usersRepository.save(user);
      } else {
        user = this.usersRepository.create({
          email: profile.email,
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

  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If that email is registered, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600_000); // 1 hour

    user.password_reset_token = await bcrypt.hash(token, 10);
    user.password_reset_expires = expires;
    await this.usersRepository.save(user);

    // In production, send email with reset link containing the raw token.
    // For now, log it (stub provider will pick it up).
    this.logger.log(`Password reset token for ${email}: ${token}`);

    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const users = await this.usersRepository.find({
      where: { password_reset_expires: MoreThan(new Date()) },
    });

    let matchedUser: User | null = null;
    for (const user of users) {
      if (user.password_reset_token && (await bcrypt.compare(token, user.password_reset_token))) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    matchedUser.password_hash = await bcrypt.hash(newPassword, 12);
    matchedUser.password_reset_token = null as any;
    matchedUser.password_reset_expires = null as any;
    await this.usersRepository.save(matchedUser);

    return { message: 'Password has been reset successfully' };
  }

  private generateTokens(payload: { email: string; sub: string; role: string }) {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: '7d',
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
    };
  }

  private getRefreshSecret(): string {
    return (this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret');
  }
}
