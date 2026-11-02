import { Controller } from "@nestjs/common";
import { MessagePattern, Payload, RpcException } from "@nestjs/microservices";

import {
  authenticateRpcSchema,
  contactsWithPermissionRpcSchema,
  RPC,
  usersByIdsRpcSchema,
  type RpcError,
} from "@/common/contracts/rpc.js";
import { AppError } from "@/common/errors/app-error.js";
import { AuthService } from "@/modules/auth/auth.service.js";
import { DirectoryPublisherService } from "@/modules/service-link/directory-publisher.service.js";
import { UsersService } from "@/modules/users/users.service.js";

/** Keeps an AppError's status and code on the wire. Anything else is a plain internal error. */
const rpc = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) {
      const body: RpcError = {
        status: error.status,
        code: error.code,
        message: error.message,
        details: error.details,
      };
      throw new RpcException(body);
    }
    throw error;
  }
};

/**
 * What the attendance service may ask this one. Reached over the private TCP port only:
 * this listener isn't behind the HTTP guards, so it trusts whoever can connect to it.
 */
@Controller()
export class EmployeeRpcController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly directory: DirectoryPublisherService,
  ) {}

  @MessagePattern(RPC.authenticate)
  authenticate(@Payload() payload: unknown) {
    const { accessToken } = authenticateRpcSchema.parse(payload);
    return rpc(() => this.auth.authenticate(accessToken));
  }

  /** A Map can't cross the wire, so this returns its entries. */
  @MessagePattern(RPC.namesByIds)
  namesByIds(@Payload() payload: unknown) {
    const { organizationId, ids } = usersByIdsRpcSchema.parse(payload);
    return rpc(async () => [...(await this.users.namesByIds(organizationId, ids)).entries()]);
  }

  @MessagePattern(RPC.contactsByIds)
  contactsByIds(@Payload() payload: unknown) {
    const { organizationId, ids } = usersByIdsRpcSchema.parse(payload);
    return rpc(() => this.users.contactsByIds(organizationId, ids));
  }

  @MessagePattern(RPC.contactsWithPermission)
  contactsWithPermission(@Payload() payload: unknown) {
    const { organizationId, permission } = contactsWithPermissionRpcSchema.parse(payload);
    return rpc(() => this.users.contactsWithPermission(organizationId, permission));
  }

  @MessagePattern(RPC.resyncDirectory)
  resyncDirectory() {
    return rpc(() => this.directory.resync());
  }
}
