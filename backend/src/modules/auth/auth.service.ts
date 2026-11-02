import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService, TokenExpiredError } from "@nestjs/jwt";

import { hash, verify } from "@node-rs/argon2";
import { PinoLogger } from "nestjs-pino";

import { generateToken, hashToken } from "@/common/crypto/tokens.js";
import { UnauthenticatedError } from "@/common/errors/app-error.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import { PrismaService } from "@/infra/employee-db/prisma.service.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_REUSE_GRACE_MS,
  SESSION_TTL_MS,
} from "@/modules/auth/auth.constants.js";
import {
  AccessTokenExpiredError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReusedError,
  RegistrationDisabledError,
} from "@/modules/auth/auth.errors.js";
import type { LoginDto } from "@/modules/auth/dto/login.dto.js";
import type { RegisterDto } from "@/modules/auth/dto/register.dto.js";
import { SessionsRepository, type ClientInfo } from "@/modules/auth/sessions.repository.js";
import { USER_EVENTS, UserEvent } from "@/modules/users/users.events.js";
import { UsersService, type ActiveUser } from "@/modules/users/users.service.js";

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

type AccessTokenPayload = { sub: string; sid: string };

type RefreshOutcome =
  | { kind: "ok"; userId: string; sessionId: string; expiresAt: Date }
  | { kind: "invalid" }
  | { kind: "reused"; sessionId: string };

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsRepository,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly events: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(input: LoginDto, client: ClientInfo): Promise<TokenPair> {
    const candidate = await this.users.findLoginCandidate(input.email);
    // Always verify against some hash so response time doesn't reveal whether the email
    // exists. Invited users have no password yet: they look like a wrong password.
    const passwordHash = candidate?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await verify(passwordHash, input.password);
    if (!candidate?.passwordHash || !passwordMatches || candidate.isDisabled) {
      if (candidate) {
        // docs/12-logging-and-observability.md#audit-log — failed sign-ins on real accounts.
        // Not awaited: waiting for the write only when the email exists would make this
        // path slower than the unknown-email one, a timing leak. The audit service
        // catches its own errors, so nothing is left unhandled.
        this.events.emit(
          USER_EVENTS.signInFailed,
          new UserEvent(USER_EVENTS.signInFailed, candidate.organizationId, null, candidate.id, {
            ip: client.ip,
          }),
        );
      }
      throw new InvalidCredentialsError();
    }

    const tokens = await this.startSession(candidate.id, client);
    const user = await this.users.findActive(candidate.id);
    if (user) {
      await this.events.emitAsync(
        USER_EVENTS.signedIn,
        new UserEvent(USER_EVENTS.signedIn, user.organizationId, user.id, user.id, {
          ip: client.ip,
        }),
      );
    }
    return tokens;
  }

  /** Public sign-up: a new organization owned by the new user, signed in right away. */
  async register(input: RegisterDto, client: ClientInfo): Promise<TokenPair> {
    if (!this.config.get("REGISTRATION_ENABLED")) throw new RegistrationDisabledError();
    const user = await this.users.registerOwner(input);
    try {
      await this.users.requestEmailVerification(user.id);
    } catch (error) {
      // The account works without it; they can resend from the app
      this.logger.error({ err: error, userId: user.id }, "Queueing verification email failed");
    }
    return this.startSession(user.id, client);
  }

  /** Sets the invited user's password and signs them in. */
  async acceptInvitation(token: string, password: string, client: ClientInfo): Promise<TokenPair> {
    const user = await this.users.acceptInvitation(token, password);
    return this.startSession(user.id, client);
  }

  /**
   * Rotates the refresh token. A token used twice outside the grace window
   * means it was stolen: the whole session is revoked.
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<TokenPair> {
    const now = new Date();

    const outcome = await this.prisma.$transaction(async (tx): Promise<RefreshOutcome> => {
      const token = await this.sessions.findRefreshTokenByHash(hashToken(refreshToken), tx);
      if (!token) return { kind: "invalid" };

      const { session } = token;
      if (session.revokedAt || session.expiresAt <= now || token.expiresAt <= now) {
        return { kind: "invalid" };
      }

      const claimed = await this.sessions.claimRefreshToken(token.id, now, tx);
      if (!claimed) {
        // Re-read: under concurrency the first read may predate the other claim.
        const usedAt = await this.sessions.findRefreshTokenUsedAt(token.id, tx);
        const isConcurrentRefresh =
          usedAt !== null && now.getTime() - usedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
        if (!isConcurrentRefresh) return { kind: "reused", sessionId: session.id };
      }

      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      await this.sessions.touchSession(session.id, { lastUsedAt: now, expiresAt, ...client }, tx);
      return { kind: "ok", userId: session.userId, sessionId: session.id, expiresAt };
    });

    // Revoke outside the transaction: throwing inside it would roll the revocation back.
    if (outcome.kind === "reused") {
      await this.sessions.revokeSession(outcome.sessionId, now);
      throw new RefreshTokenReusedError();
    }
    if (outcome.kind === "invalid") throw new InvalidRefreshTokenError();

    const user = await this.users.findActive(outcome.userId);
    if (!user) {
      await this.sessions.revokeSession(outcome.sessionId, now);
      throw new InvalidRefreshTokenError();
    }
    return this.issueTokens(outcome.userId, outcome.sessionId, outcome.expiresAt);
  }

  /** Verifies an access token and loads the caller. Used by JwtAuthGuard on every request. */
  async authenticate(accessToken: string): Promise<AuthUser> {
    const payload = await this.jwt
      .verifyAsync<AccessTokenPayload>(accessToken)
      .catch((error: unknown) => {
        throw error instanceof TokenExpiredError
          ? new AccessTokenExpiredError()
          : new UnauthenticatedError();
      });

    // Checking the session makes logout and reuse-revocation take effect immediately.
    const [session, user] = await Promise.all([
      this.sessions.findActiveSession(payload.sid, payload.sub, new Date()),
      this.users.findActive(payload.sub),
    ]);
    if (!session || !user) throw new UnauthenticatedError();

    return {
      id: user.id,
      sessionId: session.id,
      organizationId: user.organizationId,
      permissions: user.permissions,
    };
  }

  async logout(user: AuthUser): Promise<void> {
    await this.sessions.revokeSession(user.sessionId, new Date());
  }

  /** Ends every session of this user, including the current one. */
  async logoutAll(user: AuthUser): Promise<void> {
    await this.sessions.revokeAllForUser(user.id, new Date());
    await this.events.emitAsync(
      USER_EVENTS.signedOutEverywhere,
      new UserEvent(USER_EVENTS.signedOutEverywhere, user.organizationId, user.id, user.id),
    );
  }

  async me(user: AuthUser): Promise<ActiveUser> {
    const active = await this.users.findActive(user.id);
    if (!active) throw new UnauthenticatedError();
    return active;
  }

  private async startSession(userId: string, client: ClientInfo): Promise<TokenPair> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await this.sessions.createSession({ userId, expiresAt, ...client });
    return this.issueTokens(userId, session.id, expiresAt);
  }

  private async issueTokens(
    userId: string,
    sessionId: string,
    sessionExpiresAt: Date,
  ): Promise<TokenPair> {
    const refreshToken = generateToken();
    await this.sessions.insertRefreshToken({
      sessionId,
      tokenHash: hashToken(refreshToken),
      expiresAt: sessionExpiresAt,
    });

    const accessToken = await this.jwt.signAsync({ sid: sessionId }, { subject: userId });
    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
      refreshToken,
      refreshTokenExpiresAt: sessionExpiresAt.toISOString(),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash("dummy-password-for-timing-only");
    return this.dummyHash;
  }
}
