"use client";

import { useTransition } from "react";

import { ChevronDownIcon, LogOutIcon, MonitorSmartphoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction, logoutAllAction } from "@/features/auth/actions";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";

export function UserMenu() {
  const user = useCurrentUser();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Signing out…" : user.name}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => logoutAction())}>
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => startTransition(() => logoutAllAction())}>
          <MonitorSmartphoneIcon aria-hidden />
          Sign out everywhere
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
