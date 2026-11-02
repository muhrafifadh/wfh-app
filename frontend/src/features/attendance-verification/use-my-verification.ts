"use client";

import { useQuery } from "@tanstack/react-query";

import { routes } from "@/config/routes";
import { verificationKeys } from "@/features/attendance-verification/query-keys";
import {
  myVerificationSchema,
  type MyVerification,
} from "@/features/attendance-verification/schemas";
import { fetchJson } from "@/lib/api/fetch-json";

const fetchMine = () => fetchJson(routes.myVerificationApi(), myVerificationSchema);

/** The employee's checks, shared by today's card and the panel. Null skips the read. */
export function useMyVerification(initial: MyVerification | null) {
  return useQuery({
    queryKey: verificationKeys.mine(),
    queryFn: fetchMine,
    initialData: initial ?? undefined,
    enabled: initial !== null,
    staleTime: 30_000,
  }).data;
}
