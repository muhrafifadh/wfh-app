import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import { CurrentUserProvider } from "@/features/auth/components/current-user-provider";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireUser } from "@/lib/auth/session";

/**
 * Everything under (app) needs a user. Reading the session is request-time work,
 * so with Cache Components it streams in behind this boundary.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <CurrentUserProvider user={user}>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="font-semibold">
            {siteConfig.name}
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </CurrentUserProvider>
  );
}

function AppShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
