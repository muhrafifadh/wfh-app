import { Injectable } from "@nestjs/common";

import { pageWindow } from "@/common/dto/pagination.js";
import type { NotificationStatus } from "@/generated/attendance-db/client.js";
import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import type { Tx } from "@/infra/attendance-db/prisma.types.js";
import type { NotificationType } from "@/modules/notifications/domain/notification-rules.js";

export type NotificationInsert = {
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  subjectId: string;
  dedupeKey: string;
  /** Reminders only. */
  workDate?: Date;
  expiresAt?: Date;
};

const preferenceFields = {
  reviewRequestsEmail: true,
  correctionUpdatesEmail: true,
  checkInReminderEmail: true,
  checkOutReminderEmail: true,
} as const;

export type EmailPreferences = {
  reviewRequestsEmail: boolean;
  correctionUpdatesEmail: boolean;
  checkInReminderEmail: boolean;
  checkOutReminderEmail: boolean;
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Inserts the new ones; a dedupe key that already exists is skipped. Returns the new ids. */
  async insertNew(rows: NotificationInsert[], tx: Tx = this.prisma): Promise<string[]> {
    if (rows.length === 0) return [];
    const created = await tx.notification.createManyAndReturn({
      data: rows,
      skipDuplicates: true,
      select: { id: true },
    });
    return created.map((row) => row.id);
  }

  findById(id: string, tx: Tx = this.prisma) {
    return tx.notification.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        recipientId: true,
        type: true,
        subjectId: true,
        status: true,
        workDate: true,
        expiresAt: true,
        title: true,
      },
    });
  }

  /** Retention (§18.5): deletes notifications created before `before`. Returns the count. */
  async deleteCreatedBefore(before: Date, tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.notification.deleteMany({ where: { createdAt: { lt: before } } });
    return count;
  }

  /** Records the in-app title and link of a pending notification before its email goes out. */
  async setContent(id: string, title: string, link: string, tx: Tx = this.prisma): Promise<void> {
    await tx.notification.updateMany({ where: { id, status: "pending" }, data: { title, link } });
  }

  /** Moves a pending notification to its final state. False if it wasn't pending any more. */
  async finish(
    id: string,
    data: {
      status: Exclude<NotificationStatus, "pending">;
      sentAt?: Date;
      emailedAt?: Date;
      failureCode?: string;
    },
    tx: Tx = this.prisma,
  ): Promise<boolean> {
    const { count } = await tx.notification.updateMany({
      where: { id, status: "pending" },
      data,
    });
    return count === 1;
  }

  // The recipient's list (§18.6): delivered ones only

  async listDelivered(
    recipientId: string,
    query: { page: number; pageSize: number; unread?: boolean },
    tx: Tx = this.prisma,
  ) {
    const where = {
      recipientId,
      status: "sent" as const,
      ...(query.unread && { readAt: null }),
    };
    const [rows, total] = await Promise.all([
      tx.notification.findMany({
        where,
        select: { id: true, type: true, title: true, link: true, sentAt: true, readAt: true },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        ...pageWindow(query),
      }),
      tx.notification.count({ where }),
    ]);
    return { rows, total };
  }

  countUnread(recipientId: string, tx: Tx = this.prisma): Promise<number> {
    return tx.notification.count({ where: { recipientId, status: "sent", readAt: null } });
  }

  /** Marks one of the recipient's delivered notifications read. False if it isn't theirs. */
  async markRead(id: string, recipientId: string, now: Date, tx: Tx = this.prisma) {
    const row = await tx.notification.findFirst({
      where: { id, recipientId, status: "sent" },
      select: { readAt: true },
    });
    if (!row) return false;
    if (!row.readAt) {
      await tx.notification.update({ where: { id }, data: { readAt: now } });
    }
    return true;
  }

  async markAllRead(recipientId: string, now: Date, tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.notification.updateMany({
      where: { recipientId, status: "sent", readAt: null },
      data: { readAt: now },
    });
    return count;
  }

  // Email preferences (§18.7)

  findPreferences(userId: string, tx: Tx = this.prisma) {
    return tx.notificationPreference.findUnique({
      where: { userId },
      select: preferenceFields,
    });
  }

  upsertPreferences(userId: string, data: EmailPreferences, tx: Tx = this.prisma) {
    return tx.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: preferenceFields,
    });
  }
}
