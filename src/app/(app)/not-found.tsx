import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

/** notFound() in an (app) page, and unknown URLs (see [...notFound]), render inside the shell. */
export default function AppNotFound() {
  return (
    <div className="grid flex-1 place-items-center py-16 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Button asChild>
          <Link href={routes.dashboard()}>Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
