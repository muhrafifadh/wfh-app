import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { DIRECTORY_SYNC_QUEUE } from "@/common/contracts/service-events.js";
import { AuthModule } from "@/modules/auth/auth.module.js";
import { DirectoryPublisherRepository } from "@/modules/service-link/directory-publisher.repository.js";
import { DirectoryPublisherService } from "@/modules/service-link/directory-publisher.service.js";
import { EmployeeRpcController } from "@/modules/service-link/employee-rpc.controller.js";
import { UsersModule } from "@/modules/users/users.module.js";

/** The employee service's side of the link to the attendance service. */
@Module({
  imports: [BullModule.registerQueue({ name: DIRECTORY_SYNC_QUEUE }), AuthModule, UsersModule],
  controllers: [EmployeeRpcController],
  providers: [DirectoryPublisherRepository, DirectoryPublisherService],
})
export class ServiceLinkModule {}
