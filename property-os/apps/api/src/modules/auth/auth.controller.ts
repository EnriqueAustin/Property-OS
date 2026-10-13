import { Controller, Post, Body, UnauthorizedException, Get, Request, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import {
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleExchangeDto,
  AcceptInviteDto,
} from './dto/login.dto';

@Controller('auth')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto.token, dto.password);
  }

  @Public()
  @Post('google/exchange')
  async googleExchange(@Body() dto: GoogleExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Request() req, @Res() res: Response) {
    const result = await this.authService.findOrCreateGoogleUser(req.user);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    // Don't leak tokens via the URL (history/logs/Referer). Hand over a
    // short-lived one-time code the SPA exchanges via POST /auth/google/exchange.
    const code = this.authService.createGoogleExchangeCode(result.tokens);
    const params = new URLSearchParams({ code });
    res.redirect(`${frontendUrl}/login/callback?${params.toString()}`);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Get('me')
  async getMe(@Request() req) {
    return this.authService.getUser(req.user.sub ?? req.user.userId);
  }
}
