import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { ZodSerializerDto } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { Public } from "@/common/decorators/public.decorator.js";
import { ThrottleKey } from "@/common/throttling/throttle-key.decorator.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AuthService } from "@/modules/auth/auth.service.js";
import { LoginDto } from "@/modules/auth/dto/login.dto.js";
import { MeResponse } from "@/modules/auth/dto/me.response.js";
import { RefreshDto } from "@/modules/auth/dto/refresh.dto.js";
import { TokenPairResponse } from "@/modules/auth/dto/token-pair.response.js";
import type { ClientInfo } from "@/modules/auth/sessions.repository.js";

const clientInfo = (req: Request): ClientInfo => ({
  ip: req.ip ?? null,
  userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
});

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Public()
  // 5/min per client + email; 20/min per client across all emails (stuffing cap)
  @Throttle({ default: { limit: 5, ttl: 60_000 }, perIp: { limit: 20, ttl: 60_000 } })
  @ThrottleKey("email")
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TokenPairResponse)
  @ApiUnauthorizedResponse({ description: "INVALID_CREDENTIALS" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, clientInfo(req));
  }

  @Post("refresh")
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TokenPairResponse)
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

  @Get("me")
  @Authenticated()
  @ApiBearerAuth()
  @ZodSerializerDto(MeResponse)
  @ApiUnauthorizedResponse({ description: "UNAUTHENTICATED or TOKEN_EXPIRED" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }
}
