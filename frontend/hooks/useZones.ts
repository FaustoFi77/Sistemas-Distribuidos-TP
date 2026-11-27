"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { AlertFilters, ZoneInput } from "@/lib/types";
import {
  acknowledgeAlert,
  createZone,
  deleteZone,
  getPetMonitoring,
  listAlerts,
  listPetZones,
  updateZone,
} from "@/services/zones";

export const usePetZones = (petId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: queryKeys.zones.byPet(petId ?? ""),
    queryFn: () => listPetZones(petId as string),
    enabled: enabled && !!petId,
  });

/** Estado de monitoreo. Lo mantiene fresco el stream SSE; el polling lento es solo un respaldo. */
export const useMonitoring = (petId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: queryKeys.monitoring.byPet(petId ?? ""),
    queryFn: () => getPetMonitoring(petId as string),
    enabled: enabled && !!petId,
    refetchInterval: 60_000,
  });

function useInvalidateZones(petId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.zones.byPet(petId) });
    qc.invalidateQueries({ queryKey: queryKeys.monitoring.byPet(petId) });
  };
}

export function useCreateZone(petId: string) {
  const invalidate = useInvalidateZones(petId);
  return useMutation({ mutationFn: (body: ZoneInput) => createZone(petId, body), onSuccess: invalidate });
}

export function useUpdateZone(petId: string) {
  const invalidate = useInvalidateZones(petId);
  return useMutation({
    mutationFn: ({ zoneId, body }: { zoneId: string; body: Partial<ZoneInput> }) => updateZone(zoneId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteZone(petId: string) {
  const invalidate = useInvalidateZones(petId);
  return useMutation({ mutationFn: (zoneId: string) => deleteZone(zoneId), onSuccess: invalidate });
}

export const useAlerts = (filters: AlertFilters, enabled = true) =>
  useQuery({
    queryKey: queryKeys.alerts.list(filters),
    queryFn: () => listAlerts(filters),
    enabled,
    placeholderData: keepPreviousData,
  });

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      qc.invalidateQueries({ queryKey: queryKeys.monitoring.all });
    },
  });
}
