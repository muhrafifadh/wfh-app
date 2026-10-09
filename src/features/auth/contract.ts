import type {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionUserSchema,
  tokenPairSchema,
} from "@/features/auth/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

// What we send
export type _Login = Expect<Equal<z.output<typeof loginSchema>, ApiSchema<"LoginDto">>>;
export type _Register = Expect<Equal<z.output<typeof registerSchema>, ApiSchema<"RegisterDto">>>;
export type _ForgotPassword = Expect<
  Equal<z.output<typeof forgotPasswordSchema>, ApiSchema<"PasswordResetRequestDto">>
>;
export type _ResetPassword = Expect<
  Equal<z.output<typeof resetPasswordSchema>, ApiSchema<"PasswordResetConfirmDto">>
>;

// What we receive
export type _TokenPair = Expect<
  Equal<z.output<typeof tokenPairSchema>, ApiSchema<"TokenPairResponse_Output">>
>;
export type _SessionUser = Expect<
  Equal<z.output<typeof sessionUserSchema>, ApiSchema<"MeResponse_Output">>
>;
