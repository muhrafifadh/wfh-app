import { Injectable } from "@nestjs/common";

import { EmployeeDirectory } from "@/common/contracts/directory.js";
import type { AuthUser } from "@/common/types/auth.js";
import type { MeContextResponseBody } from "@/modules/work-settings/dto/me-context.response.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

@Injectable()
export class MeContextService {
  constructor(
    private readonly workSettings: WorkSettingsService,
    private readonly employees: EmployeeDirectory,
  ) {}

  /** The app shell's context (GET /me/context): organization basics and the own profile. */
  async contextFor(user: AuthUser): Promise<MeContextResponseBody> {
    const [organization, employee] = await Promise.all([
      this.workSettings.publicSettingsOf(user.organizationId),
      this.employees.findProfileForUser(user.organizationId, user.id),
    ]);
    return {
      organization,
      employee: employee && {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        status: employee.status,
      },
    };
  }
}
