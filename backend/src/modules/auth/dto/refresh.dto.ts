import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(20).max(200),
});

export class RefreshDto extends createZodDto(refreshSchema) {}
