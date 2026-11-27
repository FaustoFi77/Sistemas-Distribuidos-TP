// Modelos base del contrato de interoperabilidad (v1).

export type Species = "dog" | "cat" | "other";

export interface AuthToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number; // segundos
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string | null;
  birthDate?: string | null;
  photoUrl?: string | null;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PetInput {
  name: string;
  species: Species;
  breed?: string | null;
  birthDate?: string | null;
  photoUrl?: string | null;
}

export interface Device {
  deviceId: string;
  name: string;
  productId: string;
  online: boolean;
  lastSeenAt: string | null;
  petId: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface PairingCode {
  code: string;
  expiresAt: string;
}

export interface EmbedToken {
  token: string;
  expiresAt: string;
}

export interface Capabilities {
  apiVersion: string;
  variants: string[];
}

// ---- Variante 3: pérdida de enlace y zonas ----

export interface SafeZone {
  id: string;
  petId: string;
  name: string;
  shape: "circle";
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneInput {
  name: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  active?: boolean;
}

export type AlertType = "ZONE_EXIT" | "LINK_LOSS";
export type AlertStatus = "active" | "resolved";

export interface AlertFilters {
  page?: number;
  limit?: number;
  status?: AlertStatus;
  type?: AlertType;
  petId?: string;
}

export interface AlertItem {
  id: string;
  petId: string;
  deviceId: string;
  zoneId: string | null;
  type: AlertType;
  status: AlertStatus;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  message: string;
  details: Record<string, unknown> | null;
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface ZoneEvaluation {
  zoneId: string;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  distanceMeters: number | null;
  inside: boolean | null;
}

export interface LastLocation {
  lat: number;
  lon: number;
  hdop?: number;
  fix?: string;
  ts: string;
}

export type LinkStatus = "online" | "offline" | "unknown";

export interface PetMonitoring {
  petId: string;
  deviceId: string | null;
  linkStatus: LinkStatus;
  collarOnline: boolean | null;
  bridgeOnline: boolean | null;
  lastSeenAt: string | null;
  lastLocation: LastLocation | null;
  insideSafeArea: boolean | null;
  zones: ZoneEvaluation[];
  activeAlerts: AlertItem[];
}

/** Payload parcial del evento SSE `monitoring.updated`. */
export interface MonitoringUpdate {
  petId: string;
  deviceId: string | null;
  collarOnline: boolean | null;
  bridgeOnline: boolean | null;
  lastSeenAt: string | null;
  lastLocation: LastLocation | null;
}
