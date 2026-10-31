"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRightIcon } from "lucide-react";

import { useNavAccess } from "@/app/(app)/_components/use-nav-access";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { navTitleFor, visibleNav } from "@/config/nav";

/** Reads the nav config directly: icon components can't be passed from a Server Component. */
export function NavMain() {
  const pathname = usePathname();
  const access = useNavAccess();

  return visibleNav(access).map((section) => (
    <SidebarGroup key={section.label}>
      <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
      <SidebarMenu>
        {section.items.map((item) =>
          item.items?.length ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.items.some((sub) => sub.href === pathname)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    <item.icon aria-hidden />
                    <span>{item.title}</span>
                    <ChevronRightIcon
                      aria-hidden
                      className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.href}>
                        <SidebarMenuSubButton asChild isActive={sub.href === pathname}>
                          <Link href={sub.href}>{sub.title}</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={navTitleFor(pathname) === item.title}
              >
                <Link href={item.href} aria-current={item.href === pathname ? "page" : undefined}>
                  <item.icon aria-hidden />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  ));
}
