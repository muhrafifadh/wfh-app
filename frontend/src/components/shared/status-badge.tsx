import { cva } from "class-variance-authority";
import {
  BanIcon,
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ClockAlertIcon,
  HourglassIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// UX_FLOWS.md §3.2: every status has a word and an icon, never color alone. Late is amber
// and Absent dark, so neither reads as the brand red.
const statusBadgeVariants = cva("", {
  variants: {
    tone: {
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      info: "bg-info-soft text-info",
      danger: "bg-destructive-soft text-destructive",
      strong: "bg-foreground text-background",
      neutral: "bg-secondary text-secondary-foreground",
    },
  },
});

type Tone = "success" | "warning" | "info" | "danger" | "strong" | "neutral";

/** Attendance statuses and completeness (lowercase API values) and correction states. */
export const STATUS_BADGES = {
  present: { label: "Present", icon: CircleCheckIcon, tone: "success" },
  late: { label: "Late", icon: ClockAlertIcon, tone: "warning" },
  absent: { label: "Absent", icon: UserXIcon, tone: "strong" },
  excused: { label: "Excused", icon: CalendarCheckIcon, tone: "neutral" },
  incomplete: { label: "Incomplete", icon: CircleDashedIcon, tone: "info" },
  pending: { label: "Pending", icon: HourglassIcon, tone: "info" },
  approved: { label: "Approved", icon: CircleCheckIcon, tone: "success" },
  rejected: { label: "Rejected", icon: BanIcon, tone: "danger" },
} as const satisfies Record<string, { label: string; icon: LucideIcon; tone: Tone }>;

export type StatusBadgeStatus = keyof typeof STATUS_BADGES;

export function StatusBadge({
  status,
  className,
}: {
  status: StatusBadgeStatus;
  className?: string;
}) {
  const { label, icon: Icon, tone } = STATUS_BADGES[status];
  return (
    <Badge className={cn(statusBadgeVariants({ tone }), className)} data-status={status}>
      <Icon aria-hidden data-icon="inline-start" />
      {label}
    </Badge>
  );
}
