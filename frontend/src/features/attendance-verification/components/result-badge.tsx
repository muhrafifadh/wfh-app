import {
  CameraIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  MapPinOffIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  RESULT_LABELS,
  type VerificationResult,
} from "@/features/attendance-verification/constants";
import { cn } from "@/lib/utils";

// UX_FLOWS.md §3.2: a word and an icon, never color alone. Declining and low accuracy are
// neutral (decisions V10, V11); only being outside the area stands out.
const STYLES: Record<VerificationResult, { icon: LucideIcon; className: string }> = {
  verified: { icon: CircleCheckIcon, className: "bg-success-soft text-success" },
  captured: { icon: CameraIcon, className: "bg-success-soft text-success" },
  outside_approved_area: { icon: TriangleAlertIcon, className: "bg-warning-soft text-warning" },
  low_accuracy: { icon: CircleHelpIcon, className: "bg-secondary text-secondary-foreground" },
  not_shared: { icon: CircleDashedIcon, className: "bg-secondary text-secondary-foreground" },
  no_approved_area: { icon: MapPinOffIcon, className: "bg-secondary text-secondary-foreground" },
};

export function ResultBadge({ result }: { result: VerificationResult }) {
  const { icon: Icon, className } = STYLES[result];
  return (
    <Badge className={cn(className)} data-result={result}>
      <Icon aria-hidden data-icon="inline-start" />
      {RESULT_LABELS[result]}
    </Badge>
  );
}
