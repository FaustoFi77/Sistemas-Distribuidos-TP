"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LinkStatusBanner } from "@/components/LinkStatusBanner";
import { PairingPanel } from "@/components/PairingPanel";
import { PetFormModal } from "@/components/PetFormModal";
import { Badge, Button, Card, ConfirmModal, ErrorBox, Spinner } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useNow } from "@/hooks/useNow";
import { useDeletePet, useDevices, usePet, useUnlinkDevice } from "@/hooks/usePets";
import { useMonitoring } from "@/hooks/useZones";
import { ApiError, errorMessage } from "@/lib/errors";
import { SPECIES_LABEL, formatDate, timeAgo } from "@/lib/format";

export default function MascotaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const { hasZones } = useCapabilities();
  const now = useNow(15_000);
  const del = useDeletePet();
  const pet = usePet(id, !del.isSuccess);
  const devices = useDevices(!!pet.data?.deviceId && !del.isSuccess);
  const monitoring = useMonitoring(id, hasZones && !!pet.data?.deviceId && !del.isSuccess);
  const unlink = useUnlinkDevice();
  const [editing, setEditing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"unlink" | "delete" | null>(null);

  if (pet.isLoading) return <Spinner />;
  if (pet.error) {
    const notFound = pet.error instanceof ApiError && pet.error.status === 404;
    return (
      <div className="grid gap-3">
        <ErrorBox error={pet.error} onRetry={notFound ? undefined : () => pet.refetch()} />
        <Link href="/mascotas" className="text-sm underline">
          ← Volver a mis mascotas
        </Link>
      </div>
    );
  }
  if (!pet.data) return null;

  const p = pet.data;
  const device = devices.data?.data.find((d) => d.deviceId === p.deviceId);

  async function confirmUnlink() {
    try {
      await unlink.mutateAsync(p.id);
      setConfirmAction(null);
      push("success", "Collar desvinculado.");
    } catch (e) {
      push("error", errorMessage(e));
    }
  }

  async function confirmDelete() {
    try {
      await del.mutateAsync(p.id);
      setConfirmAction(null);
      push("success", `${p.name} fue eliminada.`);
      router.replace("/mascotas");
    } catch (e) {
      push("error", errorMessage(e));
    }
  }

  return (
    <div className="grid gap-4">
      <Link href="/mascotas" className="text-sm text-slate-600 underline">
        ← Mis mascotas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <p className="text-sm text-slate-500">
            {SPECIES_LABEL[p.species] ?? p.species}
            {p.breed ? ` · ${p.breed}` : ""}
            {p.birthDate ? ` · nació el ${formatDate(p.birthDate)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="danger" onClick={() => setConfirmAction("delete")} disabled={del.isPending}>
            Eliminar
          </Button>
        </div>
      </div>

      {hasZones && monitoring.error && <ErrorBox error={monitoring.error} onRetry={() => monitoring.refetch()} />}
      {hasZones && monitoring.data && <LinkStatusBanner monitoring={monitoring.data} />}

      {p.deviceId ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Collar vinculado</h2>
              <p className="text-sm text-slate-500">
                {device ? `${device.name} · ` : ""}
                {p.deviceId}
                {device && ` · visto ${timeAgo(device.lastSeenAt, now)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {devices.isLoading && <span className="text-xs text-slate-500">Consultando estado…</span>}
              {device && <Badge tone={device.online ? "green" : "gray"}>{device.online ? "En línea" : "Sin conexión"}</Badge>}
              <Button variant="secondary" onClick={() => setConfirmAction("unlink")} disabled={unlink.isPending}>
                Desvincular
              </Button>
            </div>
          </div>
          {devices.error && (
            <div className="mt-3">
              <ErrorBox error={devices.error} onRetry={() => devices.refetch()} />
            </div>
          )}
        </Card>
      ) : (
        <PairingPanel petId={p.id} />
      )}

      {hasZones && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Zonas seguras</h2>
              <p className="text-sm text-slate-500">
                Definí áreas circulares para recibir avisos cuando {p.name} se aleje.
              </p>
            </div>
            <Link href={`/mascotas/${p.id}/zonas`} className="text-sm font-medium underline">
              Administrar zonas seguras →
            </Link>
          </div>
        </Card>
      )}

      {editing && <PetFormModal pet={p} onClose={() => setEditing(false)} />}

      {confirmAction === "unlink" && (
        <ConfirmModal
          title="Desvincular collar"
          message={`¿Desvincular el collar de ${p.name}? Vas a poder volver a vincularlo después.`}
          confirmLabel="Desvincular"
          variant="primary"
          pending={unlink.isPending}
          onConfirm={confirmUnlink}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === "delete" && (
        <ConfirmModal
          title={`Eliminar a ${p.name}`}
          message="Esta acción no se puede deshacer. Si tiene un collar vinculado, se desvinculará automáticamente."
          confirmLabel="Eliminar"
          pending={del.isPending}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
