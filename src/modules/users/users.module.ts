import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { UserEmailsProcessor } from "@/modules/users/jobs/user-emails.processor.js";
import { USER_EMAILS_QUEUE } from "@/modules/users/jobs/user-emails.queue.js";
import { RolesController } from "@/modules/users/roles.controller.js";
import { UsersController } from "@/modules/users/users.controller.js";
import { UsersRepository } from "@/modules/users/users.repository.js";
import { UsersService } from "@/modules/users/users.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: USER_EMAILS_QUEUE })],
  controllers: [UsersController, RolesController],
  providers: [UsersService, UsersRepository, UserEmailsProcessor],
  exports: [UsersService],
})
export class UsersModule {}
