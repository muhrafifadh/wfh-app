import Link from "next/link";

import { GalleryVerticalEndIcon } from "lucide-react";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/** shadcn "login-02" block: form on the left, brand panel on the right (lg+). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href={routes.home()} className="flex items-center gap-2 font-medium">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEndIcon className="size-4" aria-hidden />
            </span>
            {siteConfig.name}
          </Link>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </main>
      </div>
      {/* Decorative: the block's photo slot, drawn with theme tokens instead of an image */}
      <div aria-hidden className="relative hidden overflow-hidden bg-muted lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute inset-x-10 bottom-10 space-y-2">
          <p className="text-2xl font-semibold tracking-tight">{siteConfig.name}</p>
          <p className="max-w-sm text-muted-foreground">{siteConfig.description}</p>
        </div>
      </div>
    </div>
  );
}
