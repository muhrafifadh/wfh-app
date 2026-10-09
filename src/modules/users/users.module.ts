import { Module } from "@nestjs/common";

import { UsersRepository } from "@/modules/users/users.repository.js";
import { UsersService } from "@/modules/users/users.service.js";

@Module({
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
