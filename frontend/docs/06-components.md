# 06 · Components

## Rules

### Authoring

- **Write components as function declarations with named exports:** `export function InvoiceTable() {}`.
- **Declare props as `type XProps` just above the component**, and destructure them in the function signature.
- **Components that wrap a native element accept and forward its props**, including `className` (merged with `cn()`) and `ref`.
- **Keep components under ~200 lines** and with at most ~3 levels of conditional JSX. If one grows past that, split it into subcomponents or move logic into a hook.
- **Components that render data handle all their states:** loading, empty, error, and success. Use `<EmptyState>` from `components/shared/` for the empty state.
- **Use stable IDs as `key`.** Use the array index only for static lists that never change order.

### Hooks & effects

- **Calculate values during render instead of storing them in state.** If a value can be computed from props or state, compute it.
- **Use `useEffect` only to sync with something outside React** (subscriptions, DOM APIs, timers). Don't use it to fetch data, derive state, or respond to events. Put event logic in the event handler.
- **Don't add `useMemo` / `useCallback` by default.** Add them only to fix a measured performance problem, or when a stable reference is required (e.g. a dependency of another hook).
- **Move complex logic out of the component into a custom hook** (`use-invoice-filters.ts`). The hook can then be tested without rendering the component.

### Composition

- **Use `children` and slot props instead of configuration props.** If you keep adding boolean props (`showHeader`, `hideFooter`, `compact`), switch to composition.
- **Limit prop drilling to two levels.** Beyond that, use composition first, and context for that subtree second.

## shadcn/ui

- **Add primitives with the CLI:** `pnpm dlx shadcn@latest add <name>`. Don't copy them by hand.
- **`components/ui/` contains only primitives.** Only edit those files to change something theme-wide (adding a variant, adjusting tokens), and mention it in the PR.
- **Build domain components on top of primitives**, in `components/shared/` or a feature folder:

```tsx
// features/invoices/components/invoice-status-badge.tsx
import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "../types";

const STATUS_VARIANT = {
  draft: "secondary",
  sent: "outline",
  paid: "default",
  void: "destructive",
} as const satisfies Record<InvoiceStatus, React.ComponentProps<typeof Badge>["variant"]>;

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}
```

## Shared building blocks

| Need                                      | Use (`components/shared/`)                                          |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Confirm a destructive action              | `<ConfirmDialog>`: controlled, stays open until the action finishes |
| A sortable column header in a list        | `<SortHeader>`: a link to the list sorted by that column            |
| Previous / next pages                     | `<ListPagination>`: links built from the list's URL params          |
| A labelled input wired to React Hook Form | `<TextField>`                                                       |
| No data                                   | `<EmptyState>`                                                      |

## Example: wrapping a native element

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const calloutVariants = cva("rounded-lg border p-4 text-sm", {
  variants: {
    tone: {
      info: "border-border bg-muted text-foreground",
      danger: "border-destructive/50 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { tone: "info" },
});

type CalloutProps = React.ComponentProps<"div"> & VariantProps<typeof calloutVariants>;

export function Callout({ tone, className, ...props }: CalloutProps) {
  return <div role="note" className={cn(calloutVariants({ tone }), className)} {...props} />;
}
```

## Don't

- **Don't build "god components"** that take a `type` / `mode` prop and branch into completely different UIs. Make separate components.
- **Don't fetch in `useEffect`.** Fetch on the server, or use TanStack Query ([08](08-data-fetching.md)).
- **Don't use `useEffect` to copy props into state.** If the state really should reset when a prop changes, use a `key`.
- **Don't define a component inside another component's body.** It gets recreated on every render, so it loses its state.
- **Don't hand-edit shadcn files for a one-off look.** Pass `className` from the place you use it instead.

## Related

[05 Server/client boundary](05-server-client-boundary.md) · [07 Styling & theming](07-styling-and-theming.md) · [15 Accessibility](15-accessibility.md)
