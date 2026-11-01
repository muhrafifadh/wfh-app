import Link from "next/link";

import { NavMain } from "@/app/(app)/_components/nav-main";
import { NavUser } from "@/app/(app)/_components/nav-user";
import { LogoMark } from "@/components/shared/logo-mark";
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

/** shadcn sidebar-07: collapses to icons, with the user menu in the footer. The logo mark stands in for the wordmark when collapsed. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={routes.dashboard()}>
                <LogoMark className="shrink-0" />
                <div className="grid flex-1 text-left leading-tight">
                  <Wordmark className="truncate text-base" />
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
