import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";

import { Authenticator, EmployeeDirectory, UserDirectory } from "@/common/contracts/directory.js";
import { AUDIT_EVENTS_QUEUE, DIRECTORY_SYNC_QUEUE } from "@/common/contracts/service-events.js";
import { AuditForwarderListener } from "@/modules/directory/audit-forwarder.listener.js";
import { DirectorySyncProcessor } from "@/modules/directory/directory-sync.processor.js";
import { EmployeeServiceClient } from "@/modules/directory/employee-service.client.js";
import { ReplicaEmployeeDirectory } from "@/modules/directory/replica-employee.directory.js";
import { ReplicaRepository } from "@/modules/directory/replica.repository.js";
import { RpcAuthenticator, RpcUserDirectory } from "@/modules/directory/rpc-directories.js";

/** The attendance service's side of the link to the employee service. */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: DIRECTORY_SYNC_QUEUE }, { name: AUDIT_EVENTS_QUEUE })],
  providers: [
    EmployeeServiceClient,
    ReplicaRepository,
    DirectorySyncProcessor,
    AuditForwarderListener,
    { provide: EmployeeDirectory, useClass: ReplicaEmployeeDirectory },
    { provide: UserDirectory, useClass: RpcUserDirectory },
    { provide: Authenticator, useClass: RpcAuthenticator },
  ],
  exports: [EmployeeDirectory, UserDirectory, Authenticator],
})
export class DirectoryModule {}
