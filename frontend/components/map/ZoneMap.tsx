"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { applyLeafletUnmountGuard } from "@/lib/leafletGuard";
import type { LastLocation, SafeZone } from "@/lib/types";

applyLeafletUnmountGuard();

export interface Draft {
  lat: number;
  lon: number;
  radius: number;
}
export interface FocusPoint {
  lat: number;
  lon: number;
  n: number; // cambia en cada pedido para volver a disparar el efecto
}

interface Props {
  zones: SafeZone[];
  lastLocation: LastLocation | null;
  /** true = la mascota está fuera de todas las zonas activas (se pinta en rojo). */
  isOutside: boolean;
  draft: Draft | null;
  editingZoneId: string | null;
  focus: FocusPoint | null;
  onPick: (lat: number, lon: number) => void;
}

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

/** Bounds aproximados de un círculo (Circle.getBounds de Leaflet exige que esté agregado al mapa). */
function circleBounds(lat: number, lon: number, meters: number): L.LatLngBounds {
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return L.latLngBounds([lat - dLat, lon - dLon], [lat + dLat, lon + dLon]);
}

function MapClick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FitAndFocus({ zones, lastLocation, focus }: Pick<Props, "zones" | "lastLocation" | "focus">) {
  const map = useMap();
  const fitted = useRef(false);

  // Encuadre inicial: apenas hay zonas o posición conocida.
  useEffect(() => {
    if (fitted.current) return;
    const bounds = L.latLngBounds([]);
    zones.forEach((z) => bounds.extend(circleBounds(z.centerLat, z.centerLon, z.radiusMeters)));
    if (lastLocation) bounds.extend([lastLocation.lat, lastLocation.lon]);
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 17, animate: false });
      fitted.current = true;
    }
  }, [zones, lastLocation, map]);

  // Al elegir una zona para editar, se centra en ella sin dejar animaciones huérfanas.
  useEffect(() => {
    if (focus) {
      map.stop();
      map.setView([focus.lat, focus.lon], Math.max(map.getZoom(), 15), { animate: false });
    }
  }, [focus, map]);

  // Detiene cualquier animación en curso antes de desmontar el mapa (evita error `_leaflet_pos`).
  useEffect(() => () => {
    map.stop();
  }, [map]);

  return null;
}

export default function ZoneMap({ zones, lastLocation, isOutside, draft, editingZoneId, focus, onPick }: Props) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={13}
      scrollWheelZoom
      zoomAnimation={false}
      fadeAnimation={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClick onPick={onPick} />
      <FitAndFocus zones={zones} lastLocation={lastLocation} focus={focus} />

      {zones
        .filter((z) => z.id !== editingZoneId) // la zona en edición se muestra como borrador
        .map((z) => (
          <Circle
            key={z.id}
            center={[z.centerLat, z.centerLon]}
            radius={z.radiusMeters}
            interactive={false}
            pathOptions={{
              color: z.active ? "#059669" : "#94a3b8",
              fillColor: z.active ? "#10b981" : "#cbd5e1",
              fillOpacity: 0.15,
              weight: 2,
              dashArray: z.active ? undefined : "6 6",
            }}
          >
            <Tooltip sticky>
              {z.name} · {z.radiusMeters} m {z.active ? "" : "(inactiva)"}
            </Tooltip>
          </Circle>
        ))}

      {draft && (
        <Circle
          center={[draft.lat, draft.lon]}
          radius={draft.radius}
          interactive={false}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2, dashArray: "8 6" }}
        />
      )}

      {lastLocation && (
        <CircleMarker
          center={[lastLocation.lat, lastLocation.lon]}
          radius={9}
          pathOptions={{ color: "#fff", weight: 3, fillColor: isOutside ? "#dc2626" : "#2563eb", fillOpacity: 1 }}
        >
          <Tooltip>Última posición del collar</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
