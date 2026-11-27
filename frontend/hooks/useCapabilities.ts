"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { VARIANT_ZONES } from "@/lib/config";
import { queryKeys } from "@/lib/queryKeys";
import { getCapabilities } from "@/services/capabilities";

/** Lee GET /capabilities al iniciar sesión y dice si la variante de zonas está disponible. */
export function useCapabilities() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: getCapabilities,
    enabled: !!token,
    staleTime: 10 * 60_000,
  });
  const variants = query.data?.variants ?? [];
  return {
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    variants,
    hasZones: variants.includes(VARIANT_ZONES),
  };
}
