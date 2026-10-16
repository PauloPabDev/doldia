import { changePasswordInput, loginInput, registerInput } from '@habitos/contracts';
import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { type z } from 'zod';
import { CurrentUser, Public, RateLimit } from '../../common/decorators';
import type { AppRequest, AuthUser } from '../../common/request';
import { ZodPipe } from '../../common/zod.pipe';
import { UsersService } from '../users/users.service';
import { AuthService, ClientInfo } from './auth.service';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookies';

const client = (req: AppRequest): ClientInfo => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register')
  @RateLimit({ name: 'register', limit: 5, windowMs: 60 * 60_000, by: ['ip'] })
  async register(
    @Body(new ZodPipe(registerInput)) body: z.output<typeof registerInput>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(body, client(req));
    setAuthCookies(res, tokens);
    return { user: await this.users.getMe(tokens.userId) };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'login', limit: 5, windowMs: 60_000, by: ['ip', 'body.email'] })
  async login(
    @Body(new ZodPipe(loginInput)) body: z.output<typeof loginInput>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(body, client(req));
    setAuthCookies(res, tokens);
    return { user: await this.users.getMe(tokens.userId) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @RateLimit({ name: 'refresh', limit: 30, windowMs: 60_000, by: ['ip'] })
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    try {
      const tokens = await this.auth.refresh(req.cookies[REFRESH_COOKIE], client(req));
      setAuthCookies(res, tokens);
      return { user: await this.users.getMe(tokens.userId) };
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.user?.sessionId, req.cookies[REFRESH_COOKIE]);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.id, client(req));
    clearAuthCookies(res);
    return { ok: true };
  }

  @Post('password')
  @HttpCode(200)
  @RateLimit({ name: 'password', limit: 5, windowMs: 15 * 60_000, by: ['user'] })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordInput)) body: z.output<typeof changePasswordInput>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.changePassword(user.id, body, client(req));
    setAuthCookies(res, tokens);
    return { ok: true };
  }
}
