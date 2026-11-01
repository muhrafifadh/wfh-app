import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import {
  EmailPreferencesResponse,
  UpdateEmailPreferencesDto,
} from "@/modules/notifications/dto/email-preferences.dto.js";
import { ListNotificationsQuery } from "@/modules/notifications/dto/list-notifications.query.js";
import {
  MarkAllReadResponse,
  NotificationListResponse,
  UnreadCountResponse,
} from "@/modules/notifications/dto/notification.response.js";
import { NotificationsService } from "@/modules/notifications/notifications.service.js";

/** DOMAIN_RULES.md §18.6–18.7 — the caller's own notifications and email preferences. */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Delivered notifications, newest first. */
  @Get("me")
  @Authenticated()
  @ZodResponse({ status: 200, type: NotificationListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQuery) {
    return this.notifications.listMine(user, query);
  }

  @Get("me/unread-count")
  @Authenticated()
  @ZodResponse({ status: 200, type: UnreadCountResponse })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Post("me/read-all")
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: MarkAllReadResponse })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  /** Idempotent. Someone else's notification is not found. */
  @Post(":id/read")
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  async markRead(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.notifications.markRead(user, id);
  }

  @Get("preferences")
  @Authenticated()
  @ZodResponse({ status: 200, type: EmailPreferencesResponse })
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferencesOf(user.id);
  }

  @Put("preferences")
  @Authenticated()
  @ZodResponse({ status: 200, type: EmailPreferencesResponse })
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdateEmailPreferencesDto) {
    return this.notifications.updatePreferences(user, dto);
  }
}
