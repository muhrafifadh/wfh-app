import { readFileSync } from "node:fs";
import { join } from "node:path";

// WCAG 2.1 AA for the theme's text pairs (UX_FLOWS.md §11), read straight from globals.css.

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function tokensOf(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()]),
  );
}

/** oklch(L C H) → relative luminance (Björn Ottosson's OKLab → linear sRGB, clamped to gamut). */
function luminance(value: string): number {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) throw new Error(`Not an opaque oklch() color: ${value}`);
  const [, lightness, chroma, hue] = match.map(Number) as [number, number, number, number];
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

const contrast = (first: string, second: string) => {
  const [a, b] = [luminance(first), luminance(second)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** [text, background]: every pair a component draws text with. */
const PAIRS = [
  ["primary-foreground", "primary"],
  ["primary", "background"],
  ["accent-foreground", "accent"],
  ["brand-secondary-foreground", "brand-secondary"],
  ["brand-accent-foreground", "brand-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-foreground", "sidebar"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["info", "info-soft"],
  ["destructive", "destructive-soft"],
] as const;

describe.each([":root", ".dark"])("theme %s", (selector) => {
  const tokens = tokensOf(selector);

  it.each(PAIRS)("%s on %s meets AA (4.5:1)", (text, background) => {
    const ratio = contrast(tokens.get(text) ?? "", tokens.get(background) ?? "");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

it("draws the brand primary as #A50034 in light mode", () => {
  // #A50034 is oklch(0.459 0.183 15.405); white on it is about 7.9:1
  expect(tokensOf(":root").get("primary")).toBe("oklch(0.459 0.183 15.405)");
  expect(contrast("oklch(1 0 0)", "oklch(0.459 0.183 15.405)")).toBeCloseTo(7.91, 1);
});
