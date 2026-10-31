import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

/** The choices next-themes accepts (app/providers.tsx). */
export const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];
