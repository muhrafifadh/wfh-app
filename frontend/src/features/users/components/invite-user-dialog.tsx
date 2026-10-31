"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlusIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { inviteUserAction } from "@/features/users/actions";
import { RoleField } from "@/features/users/components/role-field";
import { inviteUserSchema, type InviteUserInput, type Role } from "@/features/users/schemas";
import { userSearchParams } from "@/features/users/search-params";

const FIELDS = ["email", "name", "roleId"] as const;

/** "Invite user" button + dialog. Open state is in the URL (?invite=true). */
export function InviteUserDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useQueryState("invite", userSearchParams.invite);
  const defaultRole = roles.find((role) => role.name === "member") ?? roles[0];
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", name: "", roleId: defaultRole?.id ?? "" },
  });
  const { isSubmitting, errors } = form.formState;

  async function handleSubmit(values: InviteUserInput) {
    const result = await inviteUserAction(values);
    if (result.ok) {
      toast.success(`Invitation sent to ${result.data.email}`);
      form.reset();
      await setOpen(null);
      return;
    }
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      const known = FIELDS.find((f) => f === field);
      if (known && messages?.[0]) form.setError(known, { message: messages[0] });
    }
    form.setError("root", { message: result.error });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => void setOpen(next || null)}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon aria-hidden />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              They&apos;ll get an email with a link to set their password. The link works for 7
              days.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {errors.root && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
            <TextField control={form.control} name="name" label="Name" autoComplete="off" />
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="off"
            />
            <RoleField control={form.control} name="roleId" roles={roles} />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void setOpen(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
