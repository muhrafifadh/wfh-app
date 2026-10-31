"use client";

import Link from "next/link";
import { useTransition } from "react";

import { ChevronsUpDownIcon, LifeBuoyIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { useSettingsDialog } from "@/app/(app)/_components/settings-dialog";
import { ThemeMenuSub } from "@/app/(app)/_components/theme-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { accountLinks } from "@/config/nav";
import { roleLabel } from "@/config/roles";
import { logoutAction } from "@/features/auth/actions";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";
import { useMeContext } from "@/features/profile/components/me-context-provider";
import { supportContactHref } from "@/features/profile/support-contact";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NavUser() {
  const user = useCurrentUser();
  const { isMobile } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const settings = useSettingsDialog();
  const { supportContact } = useMeContext().organization;
  const supportHref = supportContact ? supportContactHref(supportContact) : null;

  const identity = (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{isPending ? "Signing out…" : user.name}</span>
        <span className="truncate text-xs">{roleLabel(user.role.name)}</span>
      </div>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={isPending}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {identity}
              <ChevronsUpDownIcon className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">{identity}</div>
              <p className="truncate px-1 pb-1.5 text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accountLinks.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>
                  <link.icon aria-hidden />
                  {link.title}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => settings.open()}>
              <SettingsIcon aria-hidden />
              Settings
            </DropdownMenuItem>
            <ThemeMenuSub />
            <DropdownMenuSeparator />
            {/* UX_FLOWS.md §3.1: the configurable support contact */}
            {supportHref ? (
              <DropdownMenuItem asChild>
                <a href={supportHref} target="_blank" rel="noreferrer">
                  <LifeBuoyIcon aria-hidden />
                  <span className="grid leading-tight">
                    Get help
                    <span className="truncate text-xs text-muted-foreground">{supportContact}</span>
                  </span>
                </a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuLabel className="flex items-start gap-2 font-normal">
                <LifeBuoyIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <span className="grid text-sm leading-tight">
                  Need help?
                  <span className="text-xs text-muted-foreground">
                    {supportContact ?? "Contact your Admin/HR."}
                  </span>
                </span>
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => startTransition(() => logoutAction())}>
              <LogOutIcon aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
