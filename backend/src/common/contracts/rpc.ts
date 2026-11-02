import { z } from "zod";

import { AppError } from "@/common/errors/app-error.js";
import { PERMISSIONS } from "@/common/types/auth.js";

/** Request-response calls the attendance service makes to the employee service, over TCP. */
export const RPC = {
  authenticate: "auth.authenticate",
  namesByIds: "users.names_by_ids",
  contactsByIds: "users.contacts_by_ids",
  contactsWithPermission: "users.contacts_with_permission",
  resyncDirectory: "directory.resync",
} as const;

export const authenticateRpcSchema = z.object({ accessToken: z.string() });
export const usersByIdsRpcSchema = z.object({
  organizationId: z.uuid(),
  ids: z.array(z.uuid()),
});
export const contactsWithPermissionRpcSchema = z.object({
  organizationId: z.uuid(),
  permission: z.enum(PERMISSIONS),
});

/** How an AppError crosses the wire, so the caller's client gets the same status and code. */
export const rpcErrorSchema = z.object({
  status: z.number(),
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type RpcError = z.infer<typeof rpcErrorSchema>;

/** An AppError thrown in the employee service, rethrown here unchanged. */
export class RemoteAppError extends AppError {
  readonly status: number;
  readonly code: string;

  constructor(error: RpcError) {
    super(error.message, error.details);
    this.status = error.status;
    this.code = error.code;
  }
}

/** The employee service didn't answer, or answered with something unexpected. */
export class EmployeeServiceUnavailableError extends AppError {
  readonly status = 503;
  readonly code = "SERVICE_UNAVAILABLE";

  constructor() {
    super("The service is temporarily unavailable. Try again shortly.");
  }
}
