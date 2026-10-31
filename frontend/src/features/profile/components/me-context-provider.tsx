"use client";

import { createContext, use } from "react";

import type { MeContext } from "@/features/profile/schemas";

const MeContextContext = createContext<MeContext | null>(null);

/** Rendered once by the (app) layout, next to CurrentUserProvider. Display only. */
export function MeContextProvider({
  context,
  children,
}: {
  context: MeContext;
  children: React.ReactNode;
}) {
  return <MeContextContext value={context}>{children}</MeContextContext>;
}

export function useMeContext(): MeContext {
  const context = use(MeContextContext);
  if (!context) throw new Error("useMeContext() must be used inside the (app) layout.");
  return context;
}
