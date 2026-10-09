import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { Request } from "express";
import { ZodResponse } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { Public } from "@/common/decorators/public.decorator.js";
import { ThrottleKey } from "@/common/throttling/throttle-key.decorator.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AuthService } from "@/modules/auth/auth.service.js";
import { LoginDto } from "@/modules/auth/dto/login.dto.js";
import { MeResponse } from "@/modules/auth/dto/me.response.js";
import {
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
} from "@/modules/auth/dto/password-reset.dto.js";
import { RefreshDto } from "@/modules/auth/dto/refresh.dto.js";
import { RegisterDto } from "@/modules/auth/dto/register.dto.js";
import { TokenPairResponse } from "@/modules/auth/dto/token-pair.response.js";
import { PasswordResetService } from "@/modules/auth/password-reset.service.js";
import type { ClientInfo } from "@/modules/auth/sessions.repository.js";

const clientInfo = (req: Request): ClientInfo => ({
  ip: req.ip ?? null,
  userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
});

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post("register")
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ZodResponse({ status: 201, type: TokenPairResponse })
  @ApiConflictResponse({ description: "EMAIL_TAKEN" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, clientInfo(req));
  }

  @Post("login")
  @Public()
  // 5/min per client + email; 20/min per client across all emails (stuffing cap)
  @Throttle({ default: { limit: 5, ttl: 60_000 }, perIp: { limit: 20, ttl: 60_000 } })
  @ThrottleKey("email")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: "INVALID_CREDENTIALS" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, clientInfo(req));
  }

  @Post("refresh")
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: "INVALID_REFRESH_TOKEN or REFRESH_TOKEN_REUSED" })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, clientInfo(req));
  }

  @Post("logout")
  @Authenticated()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logout(user);
  }

  @Post("logout-all")
  @Authenticated()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logoutAll(user);
  }

  @Post("password-reset/request")
  @Public()
  // 3/hour per client + email; 10/hour per client across emails
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 }, perIp: { limit: 10, ttl: 60 * 60_000 } })
  @ThrottleKey("email")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ description: "Always 202, whether or not the email exists" })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    await this.passwordReset.request(dto.email);
  }

  @Post("password-reset/confirm")
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBadRequestResponse({ description: "INVALID_RESET_TOKEN or VALIDATION_FAILED" })
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    await this.passwordReset.confirm(dto.token, dto.password);
  }

  @Get("me")
  @Authenticated()
  @ApiBearerAuth()
  @ZodResponse({ status: 200, type: MeResponse })
  @ApiUnauthorizedResponse({ description: "UNAUTHENTICATED or TOKEN_EXPIRED" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }
}
