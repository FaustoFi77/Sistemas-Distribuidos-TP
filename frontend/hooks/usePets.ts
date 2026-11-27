"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { PetInput } from "@/lib/types";
import {
  createEmbedToken,
  createPairingCode,
  createPet,
  deletePet,
  getPet,
  linkDevice,
  listDevices,
  listPets,
  unlinkDevice,
  updatePet,
} from "@/services/pets";

export const usePets = (page: number, limit = 12) =>
  useQuery({
    queryKey: queryKeys.pets.page(page, limit),
    queryFn: () => listPets(page, limit),
    placeholderData: keepPreviousData,
  });

/** Todas las mascotas (hasta 100) para el mapa y filtros. */
export const useAllPets = () => useQuery({ queryKey: queryKeys.pets.listAll, queryFn: () => listPets(1, 100) });

export const usePet = (petId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.pets.detail(petId),
    queryFn: () => getPet(petId),
    enabled: enabled && !!petId,
  });

export function useCreatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PetInput) => createPet(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pets.all }),
  });
}

export function useUpdatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ petId, body }: { petId: string; body: Partial<PetInput> }) => updatePet(petId, body),
    onSuccess: (_pet, { petId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.pets.all });
      qc.invalidateQueries({ queryKey: queryKeys.pets.detail(petId) });
    },
  });
}

export function useDeletePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (petId: string) => deletePet(petId),
    onSuccess: (_res, petId) => {
      qc.removeQueries({ queryKey: queryKeys.pets.detail(petId) });
      qc.invalidateQueries({ queryKey: queryKeys.pets.all });
      qc.invalidateQueries({ queryKey: queryKeys.devices });
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      qc.invalidateQueries({ queryKey: queryKeys.monitoring.all });
    },
  });
}

export const useDevices = (enabled = true, refetchInterval: number | false = false) =>
  useQuery({
    queryKey: queryKeys.devices,
    queryFn: () => listDevices(1, 100),
    enabled,
    refetchInterval,
  });

export const useCreatePairingCode = () => useMutation({ mutationFn: (label?: string) => createPairingCode(label) });

function useInvalidatePetLinks() {
  const qc = useQueryClient();
  return (petId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.pets.all });
    qc.invalidateQueries({ queryKey: queryKeys.pets.detail(petId) });
    qc.invalidateQueries({ queryKey: queryKeys.devices });
    qc.invalidateQueries({ queryKey: queryKeys.monitoring.byPet(petId) });
  };
}

export function useLinkDevice() {
  const invalidate = useInvalidatePetLinks();
  return useMutation({
    mutationFn: ({ petId, deviceId }: { petId: string; deviceId: string }) => linkDevice(petId, deviceId),
    onSuccess: (_pet, { petId }) => invalidate(petId),
  });
}

export function useUnlinkDevice() {
  const invalidate = useInvalidatePetLinks();
  return useMutation({
    mutationFn: (petId: string) => unlinkDevice(petId),
    onSuccess: (_r, petId) => invalidate(petId),
  });
}

export const useEmbedToken = () =>
  useMutation({
    mutationFn: (body?: { deviceIds?: string[]; petId?: string; ttlS?: number }) => createEmbedToken(body),
  });
