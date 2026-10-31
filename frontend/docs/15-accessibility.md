# 15 · Accessibility

Target: **WCAG 2.2 AA**. Accessibility is part of "done", not something to add later.

## Rules

### Semantics

- **Use the right element:** `<button>` for actions and `<Link>` / `<a>` for navigation. Never put `onClick` on a `<div>` or `<span>`.
- **Use landmarks on every page:** `<header>`, `<nav>`, `<main>` (exactly one), `<footer>`.
- **Each page has exactly one `<h1>`, and headings don't skip levels** (`h2` → `h4` is not allowed).
- **Use real list and table elements:** `<ul>`/`<ol>` for lists, and `<table>` with `<th scope>` for tabular data.
- **Use ARIA only as a last resort.** shadcn/Radix primitives already handle roles, focus trapping, and keyboard support, so don't re-implement them.

### Keyboard & focus

- **Everything works with only a keyboard**, in a logical tab order.
- **Focus is always visible.** Never remove the `focus-visible` ring (shadcn primitives already have it).
- **Dialogs trap focus, and when they close, focus returns to the element that opened them.** Radix does this; don't break it.
- **After navigating or a major update, move focus somewhere sensible** (e.g. to the new page's heading or the first error).
- **The app layout has a "Skip to content" link.**

### Content

- **Images have `alt` text that describes them.** Decorative images use `alt=""`.
- **Buttons that only contain an icon have an accessible name:** `aria-label`, or `<span className="sr-only">`.
- **Every form field has a visible label.** Error messages are linked to their field (the shadcn `<FormMessage>` does this).
- **Don't use color as the only signal.** Pair it with an icon, text, or pattern (e.g. a status badge has a color _and_ a word).
- **Text contrast is at least 4.5:1** (3:1 for large text and UI controls). Check new tokens in both themes.
- **Links describe where they go.** Never write "Click here".

### Motion & dynamic content

- **Respect `prefers-reduced-motion`.** Use `motion-safe:` for non-essential animation.
- **Status updates are announced to screen readers.** Toasts (`sonner`) already do this. For custom live updates, use `role="status"` or `aria-live="polite"`.
- **Nothing flashes more than 3 times per second.**

## Examples

```tsx
// ✅ icon-only button
<Button variant="ghost" size="icon" aria-label="Delete invoice">
  <Trash2 aria-hidden />
</Button>

// ❌ a div with onClick: it can't receive focus, doesn't respond to Enter or Space, and screen readers don't announce it as a button
<div onClick={handleDelete}><Trash2 /></div>
```

```tsx
// ✅ the status is conveyed by text, not only by color
<Badge variant="destructive">
  <AlertCircle aria-hidden /> Overdue
</Badge>
```

## How to check

- `eslint-plugin-jsx-a11y` runs in CI. Don't disable its rules.
- Playwright E2E tests run `@axe-core/playwright` on every critical page. Serious and critical violations fail the build.
- Before opening a PR for UI work, use your feature with only the keyboard (Tab, Shift+Tab, Enter, Space, Esc, arrow keys).

## Don't

- **Don't add `tabIndex` values greater than 0.**
- **Don't write `outline-none` without adding a replacement `focus-visible:` style.**
- **Don't use placeholders as labels.**
- **Don't put `aria-label` on elements that already have visible text.** The label replaces the visible text for screen readers, and the two can end up saying different things.

## Related

[06 Components](06-components.md) · [07 Styling & theming](07-styling-and-theming.md) · [10 Validation & forms](10-validation-and-forms.md)
