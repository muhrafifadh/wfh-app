import { Global, Module } from "@nestjs/common";

import { EmployeeDirectory, UserDirectory } from "@/common/contracts/directory.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";
import { UsersModule } from "@/modules/users/users.module.js";
import { UsersService } from "@/modules/users/users.service.js";

@Global()
@Module({
  imports: [EmployeesModule, UsersModule],
  providers: [
    { provide: EmployeeDirectory, useExisting: EmployeesService },
    { provide: UserDirectory, useExisting: UsersService },
  ],
  exports: [EmployeeDirectory, UserDirectory],
})
export class DirectoryModule {}
