import {
  BellIcon,
  BuildingIcon,
  CalendarOffIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FilePenIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SlidersHorizontalIcon,
  UserCogIcon,
  UserRoundIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/config/routes";
import type { Permission } from "@/types/auth";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the user has at least one. The page and its actions still check on the server. */
  anyOf?: readonly Permission[];
  /** Hidden from users without an employee profile (attendance is recorded per employee). */
  needsEmployeeProfile?: boolean;
  /** Sub-links render the item as a collapsible group. */
  items?: { title: string; href: string }[];
  /** Detail pages under another path that belong to this entry (/attendance/:id → My history). */
  detailsUnder?: string;
};

export type NavSection = { label: string; items: NavItem[] };

/** What decides which entries a user sees: their permissions, and whether they're an employee. */
export type NavAccess = { permissions: readonly Permission[]; hasEmployeeProfile: boolean };

// UX_FLOWS.md §3.3 — docs/playbooks/new-feature.md: each feature adds its entry here.
export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: routes.dashboard(), icon: LayoutDashboardIcon }],
  },
  {
    label: "My attendance",
    items: [
      {
        title: "Today's attendance",
        href: routes.attendance(),
        icon: ClockIcon,
        anyOf: ["attendance:self"],
        needsEmployeeProfile: true,
      },
      {
        title: "My history",
        href: routes.attendanceHistory(),
        icon: HistoryIcon,
        detailsUnder: routes.attendance(),
        anyOf: ["attendance:self"],
        needsEmployeeProfile: true,
      },
      {
        title: "My corrections",
        href: routes.corrections(),
        icon: FilePenIcon,
        anyOf: ["correction:submit"],
        needsEmployeeProfile: true,
      },
    ],
  },
  {
    label: "Team & reports",
    items: [
      { title: "Team", href: routes.team(), icon: UsersRoundIcon, anyOf: ["attendance:read_team"] },
      {
        title: "Correction review",
        href: routes.correctionReview(),
        icon: ClipboardCheckIcon,
        anyOf: ["correction:decide_team", "correction:decide_all"],
      },
      {
        title: "Reports",
        href: routes.reports(),
        icon: ChartColumnIcon,
        anyOf: ["report:read_team", "report:read_all"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Employees",
        href: routes.employees(),
        icon: UserCogIcon,
        anyOf: ["employee:manage"],
      },
      {
        title: "Divisions",
        href: routes.divisions(),
        icon: BuildingIcon,
        anyOf: ["division:manage"],
      },
      {
        title: "Holidays",
        href: routes.holidays(),
        icon: CalendarOffIcon,
        anyOf: ["holiday:manage"],
      },
      {
        title: "Attendance settings",
        href: routes.attendanceSettings(),
        icon: SlidersHorizontalIcon,
        anyOf: ["policy:manage"],
      },
      { title: "Users", href: routes.users(), icon: UsersIcon, anyOf: ["user:read"] },
      { title: "Audit log", href: routes.auditLog(), icon: ScrollTextIcon, anyOf: ["audit:read"] },
    ],
  },
];

/** Everyone's own pages, reached from the user menu rather than the sidebar. */
export const accountLinks: NavItem[] = [
  { title: "My profile", href: routes.profile(), icon: UserRoundIcon },
  { title: "Notifications", href: routes.notifications(), icon: BellIcon },
];

const allowed = (item: NavItem, access: NavAccess) =>
  (!item.anyOf || item.anyOf.some((permission) => access.permissions.includes(permission))) &&
  (!item.needsEmployeeProfile || access.hasEmployeeProfile);

/** The sections and entries this user may see. Display only: hiding a link isn't access control. */
export const visibleNav = (access: NavAccess): NavSection[] =>
  navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowed(item, access)),
    }))
    .filter((section) => section.items.length > 0);

type TitledLink = { href: string; title: string; detailsOnly?: boolean };

const navItems = [...navSections.flatMap((section) => section.items), ...accountLinks];
const titledLinks: TitledLink[] = [
  ...navItems.flatMap((item) => [{ href: item.href, title: item.title }, ...(item.items ?? [])]),
  // Last, so they win the tie with the entry that owns the path itself
  ...navItems.flatMap((item) =>
    item.detailsUnder ? [{ href: item.detailsUnder, title: item.title, detailsOnly: true }] : [],
  ),
];

/** The nav title for a path; detail pages (/users/123) get their section's title. */
export function navTitleFor(pathname: string): string | undefined {
  // Longest matching href wins; on a tie the later link (a sub-link, a detail owner) wins
  let best: TitledLink | undefined;
  for (const link of titledLinks) {
    const matches =
      (!link.detailsOnly && pathname === link.href) || pathname.startsWith(`${link.href}/`);
    if (matches && (!best || link.href.length >= best.href.length)) best = link;
  }
  return best?.title;
}
