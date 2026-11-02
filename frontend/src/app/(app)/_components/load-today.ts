import "server-only";

import { getToday } from "@/features/attendance/queries";
import { getMyVerification } from "@/features/attendance-verification/queries";
import { reportError } from "@/lib/logger";

/** Today's card data; a failed read becomes the card's "Try again" state (UX_FLOWS.md §7.2 K). */
export async function loadToday() {
  try {
    return await getToday();
  } catch (error) {
    reportError(error);
    return null;
  }
}

/** What check-in needs. If this read fails the backend still refuses a check-in without evidence. */
export async function loadMyChecks() {
  try {
    return await getMyVerification();
  } catch (error) {
    reportError(error);
    return null;
  }
}
