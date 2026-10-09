import { cookies } from "next/headers";
import { Suspense } from "react";

import { AppBreadcrumb } from "@/app/(app)/_components/app-breadcrumb";
import { AppSidebar } from "@/app/(app)/_components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrentUserProvider } from "@/features/auth/components/current-user-provider";
import { requireUser } from "@/lib/auth/session";

/** Written by the shadcn sidebar when it's toggled. */
const SIDEBAR_COOKIE = "sidebar_state";

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

/** shadcn sidebar-07 layout. */
async function SignedInShell({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE)?.value !== "false";

  return (
    <CurrentUserProvider user={user}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset id="main">
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <AppBreadcrumb />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </CurrentUserProvider>
  );
}

function AppShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-dvh">
      <div className="hidden w-64 flex-col gap-4 border-r bg-sidebar p-4 md:flex">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
