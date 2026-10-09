"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenPairSchema,
} from "@/features/auth/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { clearTokenCookies, setTokenCookies } from "@/lib/auth/cookies";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { reportError } from "@/lib/logger";

const FIX_FIELDS = "Please fix the highlighted fields.";
const TOO_MANY = "Too many attempts. Wait a bit and try again.";

/** Turns expected backend errors into ActionResult; rethrows the rest. */
function expectedFailure(
  error: unknown,
  messages: Record<string, string> = {},
): ActionResult<never> {
  if (error instanceof ApiError) {
    const message = messages[error.code];
    if (message) return fail(message, error.fieldErrors);
    if (error.status === 429) return fail(TOO_MANY);
    if (error.status === 400 && error.fieldErrors) return fail(FIX_FIELDS, error.fieldErrors);
  }
  throw error;
}

// The auth actions below are public by nature: they run without a signed-in user.

export async function loginAction(input: unknown, next: unknown): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let tokens;
  try {
    tokens = await apiFetch("/auth/login", {
      method: "POST",
      body: parsed.data,
      schema: tokenPairSchema,
      auth: false,
    });
  } catch (error) {
    return expectedFailure(error, { INVALID_CREDENTIALS: "Email or password is incorrect." });
  }

  await setTokenCookies(tokens);
  redirect(safeRedirectPath(next)); // outside try/catch: redirect() works by throwing
}

export async function registerAction(input: unknown): Promise<ActionResult<never>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let tokens;
  try {
    tokens = await apiFetch("/auth/register", {
      method: "POST",
      body: parsed.data,
      schema: tokenPairSchema,
      auth: false,
    });
  } catch (error) {
    return expectedFailure(error, {
      EMAIL_TAKEN: "An account with this email already exists.",
      NOT_FOUND: "Sign-up is turned off.",
    });
  }

  await setTokenCookies(tokens);
  redirect(routes.dashboard());
}

/** Always "ok" for valid input: the backend never says whether the email exists. */
export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  try {
    await apiFetch("/auth/password-reset/request", {
      method: "POST",
      body: parsed.data,
      schema: z.unknown(),
      auth: false,
    });
  } catch (error) {
    return expectedFailure(error);
  }
  return ok(undefined);
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult<never>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  try {
    await apiFetch("/auth/password-reset/confirm", {
      method: "POST",
      body: parsed.data,
      schema: z.undefined(),
      auth: false,
    });
  } catch (error) {
    return expectedFailure(error, {
      INVALID_RESET_TOKEN: "This reset link is invalid or has expired. Request a new one.",
    });
  }

  // The backend signed this user out everywhere; drop any cookies this browser still has.
  await clearTokenCookies();
  redirect("/login?reset=1");
}

export async function logoutAction(): Promise<void> {
  await endSession("/auth/logout");
}

/** Ends every session of this user, on every device. */
export async function logoutAllAction(): Promise<void> {
  await endSession("/auth/logout-all");
}

async function endSession(path: "/auth/logout" | "/auth/logout-all"): Promise<void> {
  try {
    await apiFetch(path, { method: "POST", schema: z.undefined() });
  } catch (error) {
    // The session may already be gone; signing out locally must still work.
    if (!(error instanceof ApiError && error.status === 401)) reportError(error);
  }
  await clearTokenCookies();
  redirect("/login");
}
