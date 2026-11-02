import { VerificationPanel } from "@/features/attendance-verification/components/verification-panel";
import { getMyVerification } from "@/features/attendance-verification/queries";
import type { MyVerification } from "@/features/attendance-verification/schemas";
import { reportError } from "@/lib/logger";

/** Server half of the panel. A failure here hides the panel; check-in is unaffected. */
export async function VerificationPanelLoader() {
  const mine = await getMyVerification().catch((error: unknown): MyVerification | null => {
    reportError(error);
    return null;
  });
  if (!mine || (!mine.location.enabled && !mine.selfie.enabled)) return null;
  return <VerificationPanel initial={mine} />;
}
