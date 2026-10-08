# 07 · Styling & Theming

## Rules

- **Style with Tailwind utility classes.** Use inline `style={{}}` only for values computed at runtime (positions, user-chosen colors, progress widths).
- **Use design tokens, not raw values.** Color classes must use the shadcn theme tokens:

  | Use | Not |
  |---|---|
  | `bg-background`, `text-foreground` | `bg-white`, `text-black` |
  | `text-muted-foreground` | `text-gray-500` |
  | `bg-primary text-primary-foreground` | `bg-blue-600 text-white` |
  | `border-border`, `border-input` | `border-gray-200` |
  | `bg-destructive`, `text-destructive` | `bg-red-500` |
  | `ring-ring` | `ring-blue-400` |

- **Every screen works in light and dark mode.** Token classes switch automatically, so you should rarely need a `dark:` class. If you're writing many `dark:` classes, a token is missing.
- **Combine classes with `cn()`.** Never join class strings with template literals: `tailwind-merge` resolves conflicting classes, and string joining doesn't.
- **Use `cva` for variants**, not ternaries inside `className`.
- **Write mobile-first.** Base classes are for the smallest screen. Add `sm:` / `md:` / `lg:` for larger ones. Check every screen at 360px wide.
- **Use arbitrary values (`w-[372px]`) only once.** If the same value appears twice, add it to the theme.
- **Use Tailwind's spacing scale for all spacing.** Use `gap-*` for spacing between items. Don't use margin to space siblings.
- **Don't sort classes by hand.** `prettier-plugin-tailwindcss` does it.

## Theme tokens

Tokens are CSS variables in `src/app/globals.css`. Each one is defined in `:root` (light) and `.dark`, and exposed to Tailwind through `@theme inline`.

**To add a token** (e.g. `success`):

```css
:root  { --success: oklch(0.62 0.17 150); --success-foreground: oklch(0.98 0 0); }
.dark  { --success: oklch(0.70 0.15 150); --success-foreground: oklch(0.15 0 0); }

@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

Now `bg-success text-success-foreground` works in both themes. Always add a token and its `-foreground` partner together, and check that their contrast meets AA ([15](15-accessibility.md)).

## Dark mode

- `next-themes` is set up in `app/providers.tsx` with `attribute="class"`, and follows the system theme by default.
- Components that render differently by theme (e.g. a theme toggle icon) must wait until after mount. See the hydration rules in [05](05-server-client-boundary.md).

## Layering

Use only this z-index scale, so stacking order stays predictable:

| Layer | Class |
|---|---|
| Sticky headers | `z-10` |
| Dropdowns, popovers | `z-20` |
| Overlays / sheets | `z-30` |
| Modals / dialogs | `z-40` |
| Toasts | `z-50` |

shadcn primitives already follow this scale. Don't use `z-[9999]`.

## Don't

- **Don't hard-code colors**, including hex or rgb values in arbitrary classes.
- **Don't build class names dynamically** (`` `text-${color}-500` ``). Tailwind can't detect them, so they don't get generated. Map values to full class names instead.
- **Don't use `!important` (`!` prefix)** to win a specificity fight. Use `cn()` so the later class wins.
- **Don't write new CSS files or CSS-in-JS.** Everything goes through Tailwind and `globals.css`.

## Related

[06 Components](06-components.md) · [15 Accessibility](15-accessibility.md)
