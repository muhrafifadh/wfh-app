import Link from "next/link";

import { Wordmark } from "@/components/shared/wordmark";
import { routes } from "@/config/routes";
import { AuthBrandPanel } from "@/features/auth/components/auth-brand-panel";

/** shadcn "login-02" block: form on the left, brand panel on the right (lg+). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href={routes.dashboard()} className="flex items-center gap-2 text-lg">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
            >
              H
            </span>
            <Wordmark />
          </Link>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </main>
      </div>
      <AuthBrandPanel />
    </div>
  );
}
