"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { loginSchema, tokenPairSchema } from "@/features/auth/schemas";
import { fail, type ActionResult } from "@/lib/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { clearTokenCookies, setTokenCookies } from "@/lib/auth/cookies";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { reportError } from "@/lib/logger";

/** Public by nature: the one action that runs without a signed-in user. */
export async function loginAction(input: unknown, next: unknown): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors);
  }

  let tokens;
  try {
    tokens = await apiFetch("/auth/login", {
      method: "POST",
      body: parsed.data,
      schema: tokenPairSchema,
      auth: false,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "INVALID_CREDENTIALS") return fail(error.message);
      if (error.status === 429)
        return fail("Too many sign-in attempts. Wait a minute and try again.");
      if (error.status === 400)
        return fail("Please fix the highlighted fields.", error.fieldErrors);
    }
    throw error;
  }

  await setTokenCookies(tokens);
  redirect(safeRedirectPath(next)); // outside try/catch: redirect() works by throwing
}

export async function logoutAction(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST", schema: z.undefined() });
  } catch (error) {
    // The session may already be gone; signing out locally must still work.
    if (!(error instanceof ApiError && error.status === 401)) reportError(error);
  }
  await clearTokenCookies();
  redirect("/login");
}
