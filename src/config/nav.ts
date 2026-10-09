import {
  FolderIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  ScrollTextIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/config/routes";
import type { Permission } from "@/types/auth";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from users without it. The page and its actions still check on the server. */
  permission?: Permission;
  /** Sub-links render the item as a collapsible group. */
  items?: { title: string; href: string }[];
};

// docs/playbooks/new-feature.md — each feature adds its entry here.
export const mainNav: NavItem[] = [
  { title: "Dashboard", href: routes.dashboard(), icon: LayoutDashboardIcon },
  {
    title: "Invoices",
    href: routes.invoices(),
    icon: ReceiptIcon,
    items: [
      { title: "All invoices", href: routes.invoices() },
      { title: "New invoice", href: routes.newInvoice() },
    ],
  },
  { title: "Files", href: routes.files(), icon: FolderIcon },
  { title: "Users", href: routes.users(), icon: UsersIcon, permission: "user:read" },
  { title: "Audit log", href: routes.auditLog(), icon: ScrollTextIcon, permission: "audit:read" },
];

/** The nav entries this user may see. Display only: hiding a link isn't access control. */
export const visibleNav = (permissions: readonly Permission[]): NavItem[] =>
  mainNav.filter((item) => !item.permission || permissions.includes(item.permission));

const titledLinks = mainNav.flatMap((item) => [
  { href: item.href, title: item.title },
  ...(item.items ?? []),
]);

/** The nav title for a path; detail pages (/users/123) get their section's title. */
export function navTitleFor(pathname: string): string | undefined {
  // Longest matching href wins; on a tie the sub-link ("All invoices") beats its section
  let best: { href: string; title: string } | undefined;
  for (const link of titledLinks) {
    const matches = pathname === link.href || pathname.startsWith(`${link.href}/`);
    if (matches && (!best || link.href.length >= best.href.length)) best = link;
  }
  return best?.title;
}
