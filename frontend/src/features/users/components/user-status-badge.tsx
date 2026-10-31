import { Badge } from "@/components/ui/badge";
import type { UserStatus } from "@/features/users/constants";

const STATUS_VARIANT = {
  active: "default",
  invited: "outline",
  deactivated: "secondary",
} as const satisfies Record<UserStatus, React.ComponentProps<typeof Badge>["variant"]>;

export const USER_STATUS_LABEL = {
  active: "Active",
  invited: "Invited",
  deactivated: "Deactivated",
} as const satisfies Record<UserStatus, string>;

/** Status as a word, not only a color (docs/15-accessibility.md). */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{USER_STATUS_LABEL[status]}</Badge>;
}
