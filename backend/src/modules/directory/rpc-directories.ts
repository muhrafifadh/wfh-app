import { Injectable } from "@nestjs/common";

import { Authenticator, UserDirectory, type Contact } from "@/common/contracts/directory.js";
import { RPC } from "@/common/contracts/rpc.js";
import type { AuthUser, Permission } from "@/common/types/auth.js";
import { EmployeeServiceClient } from "@/modules/directory/employee-service.client.js";

/** Asks the employee service on every request, so logout still takes effect immediately. */
@Injectable()
export class RpcAuthenticator extends Authenticator {
  constructor(private readonly employeeService: EmployeeServiceClient) {
    super();
  }

  authenticate(accessToken: string): Promise<AuthUser> {
    return this.employeeService.send(RPC.authenticate, { accessToken });
  }
}

@Injectable()
export class RpcUserDirectory extends UserDirectory {
  constructor(private readonly employeeService: EmployeeServiceClient) {
    super();
  }

  async namesByIds(organizationId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    return new Map(
      await this.employeeService.send<[string, string][]>(RPC.namesByIds, { organizationId, ids }),
    );
  }

  async contactsByIds(organizationId: string, ids: string[]): Promise<Contact[]> {
    if (ids.length === 0) return [];
    return this.employeeService.send(RPC.contactsByIds, { organizationId, ids });
  }

  contactsWithPermission(organizationId: string, permission: Permission): Promise<Contact[]> {
    return this.employeeService.send(RPC.contactsWithPermission, { organizationId, permission });
  }
}
