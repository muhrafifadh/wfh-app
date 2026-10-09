import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center gap-4 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Button asChild>
          <Link href={routes.home()}>Go home</Link>
        </Button>
      </div>
    </main>
  );
}
