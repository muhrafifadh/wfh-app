import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class EmailVerificationConfirmDto extends createZodDto(
  z.strictObject({ token: z.string().min(20).max(200) }),
) {}
