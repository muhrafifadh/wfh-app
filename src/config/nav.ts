import { LayoutDashboardIcon, type LucideIcon } from "lucide-react";

import { routes } from "@/config/routes";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Sub-links render the item as a collapsible group. */
  items?: { title: string; href: string }[];
};

// docs/playbooks/new-feature.md — each feature adds its entry here.
export const mainNav: NavItem[] = [
  { title: "Dashboard", href: routes.dashboard(), icon: LayoutDashboardIcon },
];
