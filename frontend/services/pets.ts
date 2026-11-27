import { qs, request } from "@/services/http";
import type { Device, EmbedToken, Paginated, PairingCode, Pet, PetInput } from "@/lib/types";

export type { PetInput };

export const listPets = (page = 1, limit = 12) =>
  request<Paginated<Pet>>(`/pets${qs({ page, limit })}`);

export const getPet = (petId: string) => request<Pet>(`/pets/${petId}`);

export const createPet = (body: PetInput) => request<Pet>("/pets", { method: "POST", body });

export const updatePet = (petId: string, body: Partial<PetInput>) =>
  request<Pet>(`/pets/${petId}`, { method: "PATCH", body });

export const deletePet = (petId: string) => request<void>(`/pets/${petId}`, { method: "DELETE" });

// ---- Dispositivos y vínculo ----

export const createPairingCode = (label?: string) =>
  request<PairingCode>("/pairing-codes", { method: "POST", body: label ? { label } : {} });

export const listDevices = (page = 1, limit = 100) =>
  request<Paginated<Device>>(`/devices${qs({ page, limit })}`);

export const linkDevice = (petId: string, deviceId: string) =>
  request<Pet>(`/pets/${petId}/device`, { method: "PUT", body: { deviceId } });

export const unlinkDevice = (petId: string) =>
  request<void>(`/pets/${petId}/device`, { method: "DELETE" });

export const createEmbedToken = (body: { deviceIds?: string[]; petId?: string; ttlS?: number } = {}) =>
  request<EmbedToken>("/embed-token", { method: "POST", body });
