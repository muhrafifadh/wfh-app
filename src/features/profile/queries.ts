import "server-only";

import { cache } from "react";

import { meContextSchema, myEmployeeSchema } from "@/features/profile/schemas";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// docs/08-data-fetching.md — the signed-in user's own records (backend /v1/me).

/** Organization basics and the own profile, for the app shell. */
export const getMeContext = cache(() => apiFetch("/me/context", { schema: meContextSchema }));

/** Null when the user has no employee profile (an Admin/HR-only account, say). */
export const getMyEmployee = cache(async () => {
  try {
    return await apiFetch("/me/employee", { schema: myEmployeeSchema });
  } catch (error) {
    if (error instanceof ApiError && error.code === "EMPLOYEE_PROFILE_REQUIRED") return null;
    throw error;
  }
});
