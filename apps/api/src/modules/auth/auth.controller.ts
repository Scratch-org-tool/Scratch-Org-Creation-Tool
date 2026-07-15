import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthSecurityService } from './auth-security.service';
import { AuthGuard, AllowUnregistered, type AuthenticatedRequest } from '../../common/auth.guard';
import {
  AUTH_GENERIC_INVALID,
  parseForgotPasswordInput,
  parseLoginInput,
  parseRegisterBody,
  parseSignupInput,
  claimAdminSchema,
  updateUserAccessSchema,
} from '@sfcc/shared';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly authSecurity: AuthSecurityService,
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Body() body: unknown) {
    const parsed = parseLoginInput(body);
    if (!parsed.success) {
      const ip = this.authSecurity.extractClientIp(req.headers, req.ip);
      this.logger.warn(`auth_validation_failed action=login ipHash=${this.authSecurity.hashIp(ip)}`);
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    const ip = this.authSecurity.extractClientIp(req.headers, req.ip);
    return this.authService.loginWithCredentials(parsed.data, ip);
  }

  @Post('signup')
  async signup(@Req() req: Request, @Body() body: unknown) {
    const parsed = parseSignupInput(body);
    if (!parsed.success) {
      const ip = this.authSecurity.extractClientIp(req.headers, req.ip);
      this.logger.warn(`auth_validation_failed action=signup ipHash=${this.authSecurity.hashIp(ip)}`);
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    const ip = this.authSecurity.extractClientIp(req.headers, req.ip);
    return this.authService.signupWithCredentials(parsed.data, ip);
  }

  @Post('forgot-password')
  async forgotPassword(@Req() req: Request, @Body() body: unknown) {
    const parsed = parseForgotPasswordInput(body);
    if (!parsed.success) {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    const ip = this.authSecurity.extractClientIp(req.headers, req.ip);
    const result = await this.authService.sendPasswordReset(parsed.data, ip);
    return result;
  }

  @Post('register')
  @AllowUnregistered()
  @UseGuards(AuthGuard)
  register(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const parsed = parseRegisterBody(body);
    if (!parsed.success) {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    return this.authService.register(req.user.uid, req.user.email, parsed.data);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.authService.getMe(req.user.uid);
  }

  @Get('users')
  @UseGuards(AuthGuard)
  listUsers(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.authService.listUsers(req.user.uid);
  }

  @Get('users/overview')
  @UseGuards(AuthGuard)
  getUsersOverview(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.authService.getUsersOverview(req.user.uid);
  }

  @Post('claim-admin')
  @UseGuards(AuthGuard)
  claimAdmin(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const parsed = claimAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    const ip = this.authSecurity.extractClientIp(req.headers, req.ip);
    return this.authService.claimAdmin(
      req.user.uid,
      req.user.email,
      parsed.data.adminBootstrapToken,
      ip,
    );
  }

  @Patch('users/:id/access')
  @UseGuards(AuthGuard)
  updateAccess(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!req.user) throw new UnauthorizedException();
    const parsed = updateUserAccessSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    return this.authService.updateUserAccess(req.user.uid, id, parsed.data);
  }
}
