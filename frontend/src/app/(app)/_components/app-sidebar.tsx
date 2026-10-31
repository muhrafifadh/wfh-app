import Link from "next/link";

import { NavMain } from "@/app/(app)/_components/nav-main";
import { NavUser } from "@/app/(app)/_components/nav-user";
import { Wordmark } from "@/components/shared/wordmark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { routes } from "@/config/routes";

/** shadcn sidebar-07: collapses to icons, with the user menu in the footer. The "H" tile stands in for the wordmark when collapsed. */
export function AppSidebar({
  organizationName,
  ...props
}: React.ComponentProps<typeof Sidebar> & { organizationName: string }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={routes.dashboard()}>
                <div
                  aria-hidden
                  className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                >
                  H
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <Wordmark className="truncate text-base" />
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {organizationName}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
