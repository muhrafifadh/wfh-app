import type { Metadata } from "next";

import { UserGreeting } from "@/features/auth/components/user-greeting";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser(); // deduplicated with the layout's call

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
        <UserGreeting />
      </div>

      <section aria-labelledby="permissions-heading" className="space-y-2">
        <h2 id="permissions-heading" className="text-sm font-medium">
          Your permissions
        </h2>
        {user.permissions.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {user.permissions.map((permission) => (
              <li key={permission} className="rounded-md border px-2 py-1 font-mono text-xs">
                {permission}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No permissions assigned.</p>
        )}
        {can(user, "user:manage") && (
          <p className="text-sm text-muted-foreground">
            You can manage users in this organization.
          </p>
        )}
      </section>
    </div>
  );
}
