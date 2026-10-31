import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { DIVISION_STATUSES } from "@/modules/divisions/divisions.constants.js";

export const divisionResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(DIVISION_STATUSES),
  /** Active, not deleted employees currently in the division. */
  activeEmployeeCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type DivisionResponseBody = z.infer<typeof divisionResponseSchema>;

export class DivisionResponse extends createZodDto(divisionResponseSchema) {}
export class DivisionListResponse extends createZodDto(paginated(divisionResponseSchema)) {}
