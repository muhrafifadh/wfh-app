import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const tokenPairResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
});

export class TokenPairResponse extends createZodDto(tokenPairResponseSchema) {}
