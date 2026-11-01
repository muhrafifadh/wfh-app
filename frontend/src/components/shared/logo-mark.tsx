import Image from "next/image";

import { cn } from "@/lib/utils";

/** The "H" brand mark. Decorative: always pair it with the wordmark or an accessible label. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/hadir-mark.png"
      alt=""
      width={256}
      height={256}
      priority
      className={cn("size-8", className)}
    />
  );
}
