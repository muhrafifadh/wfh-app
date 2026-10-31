import type { EventEmitter2 } from "@nestjs/event-emitter";

import type { Queue } from "bullmq";
import { mock } from "vitest-mock-extended";

import { NotFoundError } from "@/common/errors/app-error.js";
import type { AuthUser } from "@/common/types/auth.js";
import type { AppConfig } from "@/config/config.module.js";
import type { MailService } from "@/infra/mail/mail.service.js";
import type { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { UserEmailJob } from "@/modules/users/jobs/user-emails.queue.js";
import {
  CannotChangeOwnAccountError,
  EmailTakenError,
  UserNotInvitedError,
} from "@/modules/users/users.errors.js";
import type { UserRow, UsersRepository } from "@/modules/users/users.repository.js";
import { UsersService } from "@/modules/users/users.service.js";

const ORG = "01a00000-0000-7000-8000-000000000001";
const ME = "01a00000-0000-7000-8000-000000000002";
const OTHER = "01a00000-0000-7000-8000-000000000003";
const ROLE = "01a00000-0000-7000-8000-000000000004";
const NEW_ROLE = "01a00000-0000-7000-8000-000000000005";

const caller: AuthUser = {
  id: ME,
  sessionId: "s",
  organizationId: ORG,
  permissions: ["user:read", "user:manage"],
};

const aUser = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: OTHER,
  organizationId: ORG,
  email: "ada@example.test",
  name: "Ada",
  passwordHash: "hash",
  emailVerifiedAt: new Date(),
  disabledAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  role: { id: ROLE, name: "member" },
  ...overrides,
});

describe("UsersService", () => {
  const repo = mock<UsersRepository>();
  const queue = mock<Queue<UserEmailJob>>();
  const events = mock<EventEmitter2>();
  let service: UsersService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new UsersService(
      repo,
      mock<PrismaService>(),
      mock<MailService>(),
      mock<AppConfig>(),
      events,
      queue,
    );
  });

  describe("invite", () => {
    const input = { email: "new@example.test", name: "New", roleId: ROLE };

    it("rejects a role from another organization", async () => {
      repo.findRoleInOrganization.mockResolvedValue(null);
      await expect(service.invite(caller, input)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.insertInvited.mock.calls).toHaveLength(0);
    });

    it("rejects an email that already has an account", async () => {
      repo.findRoleInOrganization.mockResolvedValue({ id: ROLE, name: "member" });
      repo.insertInvited.mockResolvedValue(null);
      await expect(service.invite(caller, input)).rejects.toBeInstanceOf(EmailTakenError);
      expect(queue.add.mock.calls).toHaveLength(0);
    });

    it("queues the invitation email for the new, passwordless user", async () => {
      repo.findRoleInOrganization.mockResolvedValue({ id: ROLE, name: "member" });
      repo.insertInvited.mockResolvedValue(aUser({ passwordHash: null, emailVerifiedAt: null }));

      const result = await service.invite(caller, input);

      expect(result.status).toBe("invited");
      expect(queue.add.mock.calls).toContainEqual([
        "invitation",
        { userId: OTHER },
        expect.objectContaining({ jobId: expect.stringMatching(/^invitation-/) }),
      ]);
    });
  });

  describe("update", () => {
    it("won't let you change your own role", async () => {
      repo.findInOrganization.mockResolvedValue(aUser({ id: ME }));
      await expect(service.update(caller, ME, { roleId: NEW_ROLE })).rejects.toBeInstanceOf(
        CannotChangeOwnAccountError,
      );
    });

    it("lets you change your own name", async () => {
      repo.findInOrganization.mockResolvedValue(aUser({ id: ME }));
      repo.update.mockResolvedValue(aUser({ id: ME, name: "Renamed" }));
      await expect(service.update(caller, ME, { name: "Renamed" })).resolves.toMatchObject({
        name: "Renamed",
      });
    });

    it("returns 404 for a user in another organization", async () => {
      repo.findInOrganization.mockResolvedValue(null);
      await expect(service.update(caller, OTHER, { name: "X" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("deactivate", () => {
    it("won't let you deactivate yourself", async () => {
      repo.findInOrganization.mockResolvedValue(aUser({ id: ME }));
      await expect(service.deactivate(caller, ME)).rejects.toBeInstanceOf(
        CannotChangeOwnAccountError,
      );
      expect(repo.update.mock.calls).toHaveLength(0);
    });

    it("does nothing (and emits nothing) for an already deactivated user", async () => {
      repo.findInOrganization.mockResolvedValue(aUser({ disabledAt: new Date() }));
      await expect(service.deactivate(caller, OTHER)).resolves.toMatchObject({
        status: "deactivated",
      });
      expect(repo.update.mock.calls).toHaveLength(0);
      expect(events.emitAsync.mock.calls).toHaveLength(0);
    });

    it("deactivates and announces it, so sessions are revoked and it is audited", async () => {
      repo.findInOrganization.mockResolvedValue(aUser());
      repo.update.mockResolvedValue(aUser({ disabledAt: new Date() }));
      await service.deactivate(caller, OTHER);
      expect(events.emitAsync.mock.calls).toContainEqual([
        "user.deactivated",
        expect.objectContaining({ actorId: ME, targetId: OTHER, organizationId: ORG }),
      ]);
    });
  });

  describe("resendInvitation", () => {
    it("refuses for a user who already accepted", async () => {
      repo.findInOrganization.mockResolvedValue(aUser());
      await expect(service.resendInvitation(caller, OTHER)).rejects.toBeInstanceOf(
        UserNotInvitedError,
      );
      expect(queue.add.mock.calls).toHaveLength(0);
    });
  });
});
