"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { LogOutIcon, SearchIcon, SettingsIcon, UserPlusIcon, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { useSettingsDialog } from "@/app/(app)/_components/settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { visibleNav } from "@/config/nav";
import { THEMES } from "@/config/themes";
import { logoutAction } from "@/features/auth/actions";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";
import { userListHref } from "@/features/users/search-params";

type PageLink = { title: string; href: string; icon: LucideIcon; group?: string };

/** ⌘K / Ctrl+K: jump to any page you can see, or run a quick action. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { permissions } = useCurrentUser();
  const { setTheme } = useTheme();
  const settings = useSettingsDialog();
  const [, startTransition] = useTransition();

  // A keyboard shortcut is an external event source: the one thing effects are for
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Close first, so focus doesn't land back on the trigger after navigating. */
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const pages = visibleNav(permissions).flatMap((item): PageLink[] =>
    item.items?.length
      ? item.items.map((sub) => ({ ...sub, icon: item.icon, group: item.title }))
      : [{ title: item.title, href: item.href, icon: item.icon }],
  );

  return (
    <>
      {/* Looks like a search field: wide on larger screens, an icon on phones */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K"
        className="size-9 p-0 text-muted-foreground sm:h-9 sm:w-64 sm:justify-start sm:bg-muted/40 sm:px-3 sm:font-normal lg:w-80"
      >
        <SearchIcon aria-hidden />
        <span className="sr-only sm:not-sr-only">Search…</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[11px] font-medium sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Go to a page or run a command"
      >
        {/* shadcn's CommandDialog no longer adds the cmdk root itself */}
        <Command>
          <CommandInput placeholder="Type a page or command…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup heading="Pages">
              {pages.map((page) => (
                <CommandItem
                  key={page.href + page.title}
                  value={[page.group, page.title].filter(Boolean).join(" ")}
                  onSelect={run(() => router.push(page.href))}
                >
                  <page.icon aria-hidden />
                  {page.group ? `${page.group}: ${page.title}` : page.title}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {permissions.includes("user:manage") && (
                <CommandItem onSelect={run(() => router.push(userListHref({ invite: true })))}>
                  <UserPlusIcon aria-hidden />
                  Invite a user
                </CommandItem>
              )}
              <CommandItem onSelect={run(() => void settings.open())}>
                <SettingsIcon aria-hidden />
                Settings
              </CommandItem>
              {THEMES.map(({ value, label, icon: Icon }) => (
                <CommandItem
                  key={value}
                  value={`theme ${label}`}
                  onSelect={run(() => setTheme(value))}
                >
                  <Icon aria-hidden />
                  Theme: {label}
                </CommandItem>
              ))}
              <CommandItem onSelect={run(() => startTransition(() => logoutAction()))}>
                <LogOutIcon aria-hidden />
                Sign out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
