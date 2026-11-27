"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LinkStatusBanner } from "@/components/LinkStatusBanner";
import { ZoneForm, type PickedPoint } from "@/components/ZoneForm";
import type { Draft, FocusPoint } from "@/components/map/ZoneMap";
import { Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useCapabilities } from "@/hooks/useCapabilities";
import { usePet } from "@/hooks/usePets";
import { useCreateZone, useDeleteZone, useMonitoring, usePetZones, useUpdateZone } from "@/hooks/useZones";
import { errorMessage } from "@/lib/errors";
import { formatDistance } from "@/lib/format";
import type { SafeZone, ZoneInput } from "@/lib/types";

// Leaflet usa `window`: solo se carga en el navegador.
const ZoneMap = dynamic(() => import("@/components/map/ZoneMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Cargando mapa…</div>,
});

export default function ZonasPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useToast();
  const caps = useCapabilities();
  const pet = usePet(id);
  const zones = usePetZones(id, caps.hasZones);
  const monitoring = useMonitoring(id, caps.hasZones);
  const create = useCreateZone(id);
  const update = useUpdateZone(id);
  const remove = useDeleteZone(id);

  const [editing, setEditing] = useState<SafeZone | null>(null);
  const [deleting, setDeleting] = useState<SafeZone | null>(null);
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focus, setFocus] = useState<FocusPoint | null>(null);

  const onPick = useCallback((lat: number, lon: number) => setPicked((p) => ({ lat, lon, n: (p?.n ?? 0) + 1 })), []);

  const evaluation = useMemo(() => new Map((monitoring.data?.zones ?? []).map((z) => [z.zoneId, z])), [monitoring.data]);

  if (caps.isLoading || pet.isLoading) return <Spinner />;
  if (!caps.hasZones) {
    return (
      <EmptyState title="Este servidor no ofrece zonas seguras">
        <Link href={`/mascotas/${id}`} className="underline">
          Volver a la mascota
        </Link>
      </EmptyState>
    );
  }
  if (pet.error) return <ErrorBox error={pet.error} onRetry={() => pet.refetch()} />;

  const list = zones.data ?? [];
  const lastLocation = monitoring.data?.lastLocation ?? null;
  const isOutside = monitoring.data?.insideSafeArea === false;

  async function onSubmit(input: ZoneInput) {
    if (editing) {
      await update.mutateAsync({ zoneId: editing.id, body: input });
      push("success", "Zona actualizada.");
      setEditing(null);
    } else {
      await create.mutateAsync(input);
      push("success", "Zona creada.");
    }
    setPicked(null);
  }

  async function onToggle(z: SafeZone) {
    try {
      await update.mutateAsync({ zoneId: z.id, body: { active: !z.active } });
    } catch (e) {
      push("error", errorMessage(e));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const z = deleting;
    try {
      await remove.mutateAsync(z.id);
      if (editing?.id === z.id) setEditing(null);
      setDeleting(null);
      push("success", "Zona eliminada.");
    } catch (e) {
      push("error", errorMessage(e));
    }
  }

  function startEdit(z: SafeZone) {
    setEditing(z);
    setPicked(null);
    setFocus((f) => ({ lat: z.centerLat, lon: z.centerLon, n: (f?.n ?? 0) + 1 }));
  }

  return (
    <div className="grid gap-4">
      <Link href={`/mascotas/${id}`} className="text-sm text-slate-600 underline">
        ← {pet.data?.name ?? "Mascota"}
      </Link>
      <h1 className="text-xl font-semibold">Zonas seguras{pet.data ? ` de ${pet.data.name}` : ""}</h1>

      {monitoring.error && <ErrorBox error={monitoring.error} onRetry={() => monitoring.refetch()} />}
      {monitoring.data && <LinkStatusBanner monitoring={monitoring.data} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="h-[380px] overflow-hidden rounded-xl border border-slate-200 lg:h-[580px]">
          <ZoneMap
            zones={list}
            lastLocation={lastLocation}
            isOutside={isOutside}
            draft={draft}
            editingZoneId={editing?.id ?? null}
            focus={focus}
            onPick={onPick}
          />
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <ZoneForm
              key={editing?.id ?? "new"}
              zone={editing}
              picked={picked}
              lastLocation={lastLocation}
              onDraft={setDraft}
              onSubmit={onSubmit}
              onCancel={() => {
                setEditing(null);
                setPicked(null);
              }}
            />
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Zonas ({list.length})</h2>
            {zones.isLoading && <Spinner />}
            {zones.error && <ErrorBox error={zones.error} onRetry={() => zones.refetch()} />}
            {zones.data && list.length === 0 && (
              <p className="text-sm text-slate-500">
                Todavía no definiste zonas. Sin zonas activas no se avisa cuando la mascota se aleja.
              </p>
            )}
            <ul className="grid gap-2">
              {list.map((z) => {
                const ev = evaluation.get(z.id);
                const isTogglingThis = update.isPending && update.variables?.zoneId === z.id;
                const isDeletingThis = remove.isPending && remove.variables === z.id;
                return (
                  <li
                    key={z.id}
                    className={`rounded-lg border p-3 text-sm ${
                      editing?.id === z.id ? "border-blue-400 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{z.name}</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={z.active}
                          onChange={() => onToggle(z)}
                          disabled={isTogglingThis}
                        />
                        Activa
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">Radio {z.radiusMeters} m</p>
                    {z.active && ev && ev.inside !== null && (
                      <div className="mt-1">
                        <Badge tone={ev.inside ? "green" : "red"}>
                          {ev.inside ? "Adentro" : `Afuera · ${formatDistance(ev.distanceMeters)} del centro`}
                        </Badge>
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" onClick={() => startEdit(z)}>
                        Editar
                      </Button>
                      <Button variant="danger" onClick={() => setDeleting(z)} disabled={isDeletingThis}>
                        {isDeletingThis ? "Eliminando…" : "Eliminar"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      {deleting && (
        <ConfirmModal
          title={`Eliminar zona “${deleting.name}”`}
          message="Esta zona dejará de monitorearse y no podrá recuperarse."
          confirmLabel="Eliminar"
          pending={remove.isPending}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
