import type { AlertFilters } from "@/lib/types";

/** Claves centralizadas de TanStack Query para compartir entre queries e invalidaciones. */
export const queryKeys = {
  me: ["me"] as const,
  capabilities: ["capabilities"] as const,
  pets: {
    all: ["pets"] as const,
    page: (page: number, limit: number) => ["pets", "page", page, limit] as const,
    listAll: ["pets", "all"] as const,
    detail: (petId: string) => ["pet", petId] as const,
  },
  devices: ["devices"] as const,
  zones: {
    byPet: (petId: string) => ["zones", petId] as const,
  },
  monitoring: {
    all: ["monitoring"] as const,
    byPet: (petId: string) => ["monitoring", petId] as const,
  },
  alerts: {
    all: ["alerts"] as const,
    list: (filters: AlertFilters) => ["alerts", filters] as const,
  },
};
