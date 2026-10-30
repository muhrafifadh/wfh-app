import Link from "next/link";

import { cn } from "@/lib/utils";

export type CountCard = {
  label: string;
  value: number | string;
  /** The filtered list behind the number (UX_FLOWS.md §6.4); none for a plain figure. */
  href?: string;
  /** This card is the active filter. */
  active?: boolean;
  hint?: string;
};

/** Labelled counts; each that has a list behind it links there. */
export function CountCards({ cards, label }: { cards: CountCard[]; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const body = (
          <>
            <span className="text-sm text-muted-foreground">{card.label}</span>
            <span className="text-2xl font-semibold tabular-nums">{card.value}</span>
            {card.hint && <span className="text-xs text-muted-foreground">{card.hint}</span>}
          </>
        );
        const box = cn(
          "flex h-full flex-col gap-1 rounded-lg border p-3",
          card.active && "border-primary bg-accent",
        );
        return (
          <li key={card.label}>
            {card.href ? (
              <Link
                href={card.href}
                aria-current={card.active ? "true" : undefined}
                className={cn(box, "hover:bg-accent focus-visible:bg-accent")}
              >
                {body}
              </Link>
            ) : (
              <div className={box}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
