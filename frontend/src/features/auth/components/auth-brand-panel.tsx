import { ArrowUpRight, Check, Clock3, MapPin, Users } from "lucide-react";

import { Wordmark } from "@/components/shared/wordmark";
import { siteConfig } from "@/config/site";

/** Decorative product vignette shown beside the authentication flows on large screens. */
export function AuthBrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden min-h-svh overflow-hidden bg-primary text-primary-foreground lg:block"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary-foreground)_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.08]" />
      <div className="absolute -top-24 -right-24 size-80 rounded-full border border-primary-foreground/10" />
      <div className="absolute -top-8 -right-8 size-48 rounded-full border border-primary-foreground/10" />
      <div className="absolute -bottom-44 -left-36 size-96 rounded-full bg-primary-foreground/[0.05] blur-2xl" />

      <div className="relative flex h-full min-h-svh flex-col px-10 py-10 xl:px-16 xl:py-12">
        <div className="flex items-center justify-between text-xs font-medium tracking-wide text-primary-foreground/70">
          <span>WORKDAY PULSE</span>
          <span>JAKARTA · GMT+7</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="relative w-full max-w-xl">
            <div className="absolute top-1/2 left-1/2 size-[27rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-foreground/10" />
            <div className="absolute top-1/2 left-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-foreground/10" />
            <div className="absolute top-1/2 left-1/2 h-px w-[115%] -translate-x-1/2 -rotate-12 bg-primary-foreground/10" />

            <div className="relative mx-auto w-[78%] rounded-3xl border border-background/40 bg-background p-5 text-foreground shadow-2xl shadow-foreground/20 xl:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    TODAY&apos;S ATTENDANCE
                  </p>
                  <p className="mt-1 text-lg font-semibold">Good morning, Naya</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  NS
                </span>
              </div>

              <div className="mt-8 flex items-end justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="size-2 rounded-full bg-success" />
                    Checked in
                  </div>
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.06em] tabular-nums">
                    08:57
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    Working remotely
                  </div>
                </div>
                <div className="flex size-24 items-center justify-center rounded-full border-[10px] border-success-soft bg-card">
                  <div className="text-center">
                    <Check className="mx-auto size-5 text-success" strokeWidth={3} />
                    <p className="mt-1 text-[10px] font-semibold text-success">ON TIME</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted p-4">
                  <Clock3 className="size-4 text-primary" />
                  <p className="mt-3 text-xs text-muted-foreground">Work hours</p>
                  <p className="mt-1 text-sm font-semibold">09:00 — 17:00</p>
                </div>
                <div className="rounded-2xl bg-muted p-4">
                  <Users className="size-4 text-primary" />
                  <p className="mt-3 text-xs text-muted-foreground">Team online</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-sm font-semibold">6 of 8</p>
                    <div className="flex -space-x-1.5">
                      <span className="size-5 rounded-full border-2 border-muted bg-warning-soft" />
                      <span className="size-5 rounded-full border-2 border-muted bg-info-soft" />
                      <span className="size-5 rounded-full border-2 border-muted bg-success-soft" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-12 left-2 hidden rounded-2xl border border-background/40 bg-background px-4 py-3 text-foreground shadow-xl shadow-foreground/15 xl:flex">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">ATTENDANCE</p>
                  <p className="text-xs font-semibold">You&apos;re all set</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-1 -bottom-7 flex items-center gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground px-4 py-3 text-primary shadow-xl shadow-foreground/20 xl:-right-5">
              <div>
                <p className="text-[10px] font-medium opacity-70">THIS WEEK</p>
                <p className="text-sm font-semibold">4 days on time</p>
              </div>
              <ArrowUpRight className="size-4" />
            </div>
          </div>
        </div>

        <div className="max-w-md">
          <Wordmark className="text-3xl [&>span]:text-primary-foreground" />
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">
            {siteConfig.description}
          </p>
        </div>
      </div>
    </aside>
  );
}
