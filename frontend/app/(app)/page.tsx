"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapZone } from "@ovenbird/react";
import { Badge, Card, EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useNow } from "@/hooks/useNow";
import { useAllPets, useDevices } from "@/hooks/usePets";
import { useMonitoring, usePetZones } from "@/hooks/useZones";
import { timeAgo } from "@/lib/format";
import type { Device, Pet } from "@/lib/types";

const OvenbirdLive = dynamic(() => import("@/components/map/OvenbirdLive"), {
  ssr: false,
  loading: () => <Spinner label="Cargando mapa…" />,
});

function PetRow({
  pet,
  device,
  selected,
  hasZones,
  now,
  onSelect,
}: {
  pet: Pet;
  device?: Device;
  selected: boolean;
  hasZones: boolean;
  now: number;
  onSelect: () => void;
}) {
  const monitoring = useMonitoring(pet.id, hasZones);
  const alerts = monitoring.data?.activeAlerts ?? [];

  let badge = <Badge tone={device?.online ? "green" : "gray"}>{device?.online ? "En línea" : "Sin conexión"}</Badge>;
  if (alerts.some((a) => a.type === "LINK_LOSS")) badge = <Badge tone="red">Sin enlace</Badge>;
  else if (alerts.some((a) => a.type === "ZONE_EXIT")) badge = <Badge tone="amber">Fuera de zona</Badge>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition ${
        selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span>
        <span className="block font-medium">{pet.name}</span>
        <span className="block text-xs text-slate-500">
          visto {timeAgo(monitoring.data?.lastSeenAt ?? device?.lastSeenAt, now)}
        </span>
      </span>
      {badge}
    </button>
  );
}

export default function MapaPage() {
  const { hasZones } = useCapabilities();
  const now = useNow(15_000);
  const pets = useAllPets();
  const linked = useMemo(() => (pets.data?.data ?? []).filter((p) => p.deviceId), [pets.data]);
  const devices = useDevices(linked.length > 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = linked.find((p) => p.id === selectedId) ?? linked[0] ?? null;

  const selectedZones = usePetZones(selected?.id, hasZones && !!selected);
  const zonesSignature = (selectedZones.data ?? [])
    .filter((z) => z.active)
    .map((z) => `${z.id}:${z.centerLat}:${z.centerLon}:${z.radiusMeters}:${z.name}`)
    .join("|");

  const mapZones = useMemo<MapZone[] | undefined>(() => {
    if (!zonesSignature) return undefined;
    return zonesSignature.split("|").map((entry) => {
      const [id, lat, lon, radius, ...nameParts] = entry.split(":");
      return {
        id,
        center: [Number(lat), Number(lon)] as [number, number],
        radiusM: Number(radius),
        label: nameParts.join(":"),
      };
    });
  }, [zonesSignature]);

  const deviceIds = useMemo(() => linked.map((p) => p.deviceId as string), [linked]);

  const onSelectDevice = useCallback(
    (deviceId: string) => {
      const match = linked.find((p) => p.deviceId === deviceId);
      if (match) setSelectedId(match.id);
    },
    [linked],
  );

  if (pets.isLoading) return <Spinner />;
  if (pets.error) return <ErrorBox error={pets.error} onRetry={() => pets.refetch()} />;

  if (linked.length === 0) {
    return (
      <EmptyState title="Todavía no hay collares vinculados">
        <Link href="/mascotas" className="underline">
          Cargá una mascota y vinculale un collar
        </Link>{" "}
        para verla en el mapa.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      {devices.error && <ErrorBox error={devices.error} onRetry={() => devices.refetch()} />}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card as="aside" className="grid content-start gap-2">
          <h1 className="font-semibold">Mascotas con collar</h1>
          {linked.map((pet) => (
            <PetRow
              key={pet.id}
              pet={pet}
              device={devices.data?.data.find((d) => d.deviceId === pet.deviceId)}
              selected={selected?.id === pet.id}
              hasZones={hasZones}
              now={now}
              onSelect={() => setSelectedId(pet.id)}
            />
          ))}
          {selected && (
            <Link href={`/mascotas/${selected.id}`} className="mt-1 text-sm underline">
              Ver ficha de {selected.name} →
            </Link>
          )}
        </Card>

        {hasZones && selectedZones.isLoading ? (
          <Spinner label="Cargando mapa y zonas…" />
        ) : (
          <OvenbirdLive
            deviceIds={deviceIds}
            selectedDeviceId={selected?.deviceId ?? null}
            zones={mapZones}
            onSelectDevice={onSelectDevice}
          />
        )}
      </div>
    </div>
  );
}
