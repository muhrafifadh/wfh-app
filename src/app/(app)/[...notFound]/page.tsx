import { notFound } from "next/navigation";

// This page only ever renders the 404, so there's nothing for instant-navigation
// validation to check (it reports the notFound() throw as an error otherwise).
export const instant = false;

/**
 * Catches URLs no other route matches, so their 404 renders inside the app shell
 * (app/(app)/not-found.tsx) instead of the bare root not-found page.
 */
export default function CatchAllNotFound() {
  notFound();
}
