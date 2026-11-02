import { Module } from "@nestjs/common";

import { FoundationModule } from "@/apps/foundation.module.js";
import { EmployeeDbModule } from "@/infra/employee-db/prisma.module.js";
import { AuditModule } from "@/modules/audit/audit.module.js";
import { AuthModule } from "@/modules/auth/auth.module.js";
import { DivisionsModule } from "@/modules/divisions/divisions.module.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { ServiceLinkModule } from "@/modules/service-link/service-link.module.js";
import { UploadsModule } from "@/modules/uploads/uploads.module.js";
import { UsersModule } from "@/modules/users/users.module.js";

/** Accounts, sign-in, employees, divisions, the audit log and uploads. */
@Module({
  imports: [
    FoundationModule,
    EmployeeDbModule,
    UsersModule,
    AuthModule,
    AuditModule,
    UploadsModule,
    DivisionsModule,
    EmployeesModule,
    ServiceLinkModule,
  ],
})
export class EmployeeServiceModule {}
