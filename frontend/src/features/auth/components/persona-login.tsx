"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { personaLoginAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { DEMO_PERSONAS } from "@/features/auth/constants";

const ROLES = ["Owner", "Admin/HR", "Manager", "Employee"] as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

/** One-click sign-in for testing. The login page only renders it when DEMO_LOGIN_PASSWORD is set. */
export function PersonaLogin() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [activeEmail, setActiveEmail] = useState<string>();
  const [error, setError] = useState<string>();

  function signInAs(email: string) {
    setActiveEmail(email);
    setError(undefined);
    startTransition(async () => {
      const result = await personaLoginAction(email, searchParams.get("next")); // redirects on success
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          Try a test persona
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Try a test persona</DialogTitle>
          <DialogDescription>Sign in as a seeded account, no password needed.</DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        <div className="-mx-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-4">
          {ROLES.map((role) => (
            <section key={role} aria-label={role} className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">{role}</h3>
              <ul className="flex flex-col">
                {DEMO_PERSONAS.filter((persona) => persona.role === role).map((persona) => (
                  <li key={persona.email}>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => signInAs(persona.email)}
                      className="h-auto w-full justify-start gap-3 px-2 py-1.5 text-left font-normal"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{initials(persona.name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {isPending && activeEmail === persona.email
                            ? "Signing in…"
                            : persona.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {persona.email}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
