"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { MailIcon, MoreHorizontalIcon, PencilIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/config/routes";
import {
  deactivateUserAction,
  reactivateUserAction,
  resendInvitationAction,
} from "@/features/users/actions";
import type { User } from "@/features/users/schemas";

type UserRowActionsProps = {
  user: Pick<User, "id" | "name" | "status">;
  /** The signed-in user: you can't deactivate yourself. */
  isSelf: boolean;
};

/** The "…" menu on a user row. Deactivating asks for confirmation first. */
export function UserRowActions({ user, isSelf }: UserRowActionsProps) {
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  async function handleDeactivate() {
    const result = await deactivateUserAction(user.id);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(`${user.name} was deactivated`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={`Actions for ${user.name}`}
          >
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={routes.user(user.id)}>
              <PencilIcon aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          {user.status === "invited" && (
            <DropdownMenuItem
              onSelect={() =>
                run(() => resendInvitationAction(user.id), `Invitation sent again to ${user.name}`)
              }
            >
              <MailIcon aria-hidden />
              Resend invitation
            </DropdownMenuItem>
          )}
          {!isSelf && <DropdownMenuSeparator />}
          {!isSelf && user.status === "deactivated" && (
            <DropdownMenuItem
              onSelect={() =>
                run(() => reactivateUserAction(user.id), `${user.name} was reactivated`)
              }
            >
              <UserCheckIcon aria-hidden />
              Reactivate
            </DropdownMenuItem>
          )}
          {!isSelf && user.status !== "deactivated" && (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeactivate(true)}>
              <UserXIcon aria-hidden />
              Deactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title={`Deactivate ${user.name}?`}
        description="They'll be signed out everywhere and won't be able to sign in. You can reactivate them later."
        confirmLabel="Deactivate"
        pendingLabel="Deactivating…"
        destructive
        onConfirm={handleDeactivate}
      />
    </>
  );
}
