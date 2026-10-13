import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { EmailProvider } from '../notifications/providers/email.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isProd = process.env.NODE_ENV === 'production';
        const secret = configService.get<string>('JWT_SECRET') ?? 'dev-secret';
        if (secret === 'dev-secret' && isProd) {
          throw new Error('JWT_SECRET must be set in production');
        }
        // Fail hard rather than silently falling back to 'dev-refresh-secret'.
        if (!configService.get<string>('JWT_REFRESH_SECRET') && isProd) {
          throw new Error('JWT_REFRESH_SECRET must be set in production');
        }
        return {
        secret,
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRY') ?? '15m') as any,
        },
      }; },
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, GoogleStrategy, EmailProvider],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
