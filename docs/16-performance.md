# 16 · Performance

**Budgets** (75th percentile of real users): **LCP < 2.5s · INP < 200ms · CLS < 0.1**. First-load JS for any route stays under **200 kB gzipped**.

## Rules

### Rendering

- **Keep as much as possible on the server.** Every `"use client"` adds JavaScript the browser must download ([05](05-server-client-boundary.md)).
- **Stream slow sections with `<Suspense>`** so one slow request doesn't block the whole page.
- **Run independent requests in parallel** ([08](08-data-fetching.md)).

### Images & fonts

- **Use `next/image` for every image.** Set `width`/`height` (or `fill` with a sized parent) to prevent layout shift.
- **Responsive images set `sizes`.** Set `priority` only on the LCP image, which is usually the hero image or the first visible image.
- **Load fonts with `next/font`**, through a CSS variable in the root layout. Don't load fonts with `<link>` tags or `@import`. Use at most two font families.

### JavaScript

- **Load heavy client-only components with `next/dynamic`:** charts, rich-text editors, maps, date-range pickers.
- **Before adding a dependency,** check its size (bundlephobia) and whether a native API or an existing dependency already does the job. Explain in the PR why it's needed.
- **Import only what you use:** `import { format } from "date-fns"`, not the whole library.
- **Load third-party scripts** (analytics, chat) with `next/script` and `strategy="lazyOnload"` or `"afterInteractive"`.

### Interaction

- **Keep the UI responsive during slow updates** with `useTransition` / `useDeferredValue` (e.g. filtering a large list on the client).
- **Lists with more than ~100 rows** use server pagination, or virtualization (`@tanstack/react-virtual`) if they must scroll.
- **Debounce input that triggers network requests** (300 ms).

### Metadata & SEO

- **Every route exports `metadata` / `generateMetadata`** ([04](04-routing-and-layouts.md)).
- **Public pages** have Open Graph images, a canonical URL, and are included in `app/sitemap.ts` and `app/robots.ts`.

## How to check

- Run `pnpm analyze` (`@next/bundle-analyzer`) for any PR that adds a dependency or a large client component.
- CI reports bundle size changes for each route. A route that grows by more than 10% needs a reason in the PR.
- Track real-user Core Web Vitals in production analytics (`useReportWebVitals`).

## Don't

- **Don't use `<img>`.** ESLint blocks it.
- **Don't import a whole icon set** (`import * as Icons`). Import each icon by name.
- **Don't add `useMemo`/`useCallback` without measuring first.** They have a cost too ([06](06-components.md)).
- **Don't load data for content that's out of view** before the user needs it.

## Related

[05 Server/client boundary](05-server-client-boundary.md) · [08 Data fetching](08-data-fetching.md)
