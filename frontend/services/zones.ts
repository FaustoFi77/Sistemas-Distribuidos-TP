import { qs, request } from "@/services/http";
import type { AlertFilters, AlertItem, Paginated, PetMonitoring, SafeZone, ZoneInput } from "@/lib/types";

export type { AlertFilters };

/** GET /pets/:id/zones devuelve un arreglo; GET /zones, un objeto paginado. Se aceptan ambos. */
export async function listPetZones(petId: string): Promise<SafeZone[]> {
  const res = await request<SafeZone[] | Paginated<SafeZone>>(`/pets/${petId}/zones`);
  return Array.isArray(res) ? res : (res?.data ?? []);
}

export const createZone = (petId: string, body: ZoneInput) =>
  request<SafeZone>(`/pets/${petId}/zones`, { method: "POST", body });

export const updateZone = (zoneId: string, body: Partial<ZoneInput>) =>
  request<SafeZone>(`/zones/${zoneId}`, { method: "PATCH", body });

export const deleteZone = (zoneId: string) => request<void>(`/zones/${zoneId}`, { method: "DELETE" });

export const listAlerts = (filters: AlertFilters = {}) =>
  request<Paginated<AlertItem>>(`/alerts${qs({ limit: 20, ...filters })}`);

export const acknowledgeAlert = (alertId: string) =>
  request<AlertItem>(`/alerts/${alertId}/acknowledge`, { method: "POST" });

export const getPetMonitoring = (petId: string) => request<PetMonitoring>(`/pets/${petId}/monitoring`);
