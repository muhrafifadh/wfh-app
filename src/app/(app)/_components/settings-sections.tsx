"use client";

import { useTransition } from "react";

import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { THEMES } from "@/config/themes";
import { logoutAllAction } from "@/features/auth/actions";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";

/** Read-only for now: there's no backend endpoint to update the profile yet. */
export function AccountSection() {
  const user = useCurrentUser();

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="settings-name">Name</FieldLabel>
        <Input id="settings-name" value={user.name} readOnly />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-email">Email</FieldLabel>
        <Input id="settings-email" type="email" value={user.email} readOnly />
        <FieldDescription>Contact an admin to change your name or email.</FieldDescription>
      </Field>
      <section aria-labelledby="settings-permissions" className="flex flex-col gap-2">
        <h3 id="settings-permissions" className="text-sm font-medium">
          Permissions
        </h3>
        {user.permissions.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {user.permissions.map((permission) => (
              <li key={permission}>
                <Badge variant="outline" className="font-mono">
                  {permission}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No permissions assigned.</p>
        )}
      </section>
    </FieldGroup>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <FieldSet>
      <FieldLegend variant="label">Theme</FieldLegend>
      <FieldDescription>System follows your device&apos;s light or dark setting.</FieldDescription>
      <RadioGroup value={theme ?? "system"} onValueChange={setTheme} className="sm:grid-cols-3">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <FieldLabel key={value} htmlFor={`theme-${value}`}>
            <Field orientation="horizontal">
              <Icon aria-hidden className="size-4" />
              <FieldContent>
                <FieldTitle>{label}</FieldTitle>
              </FieldContent>
              <RadioGroupItem value={value} id={`theme-${value}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

export function SecuritySection() {
  const [isPending, startTransition] = useTransition();

  return (
    <FieldGroup>
      <Field orientation="responsive">
        <FieldContent>
          <FieldTitle>Sign out everywhere</FieldTitle>
          <FieldDescription>
            Ends every session on every device, including this one.
          </FieldDescription>
        </FieldContent>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() => startTransition(() => logoutAllAction())}
        >
          {isPending ? "Signing out…" : "Sign out everywhere"}
        </Button>
      </Field>
    </FieldGroup>
  );
}
