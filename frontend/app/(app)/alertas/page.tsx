"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorBox, Pagination, Spinner } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useAllPets } from "@/hooks/usePets";
import { useAcknowledgeAlert, useAlerts } from "@/hooks/useZones";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { AlertStatus, AlertType } from "@/lib/types";

const LIMIT = 15;
const TYPE_LABEL: Record<AlertType, string> = { ZONE_EXIT: "Salió de la zona", LINK_LOSS: "Sin enlace con el collar" };
const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export default function AlertasPage() {
  const caps = useCapabilities();
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AlertStatus | "">("");
  const [type, setType] = useState<AlertType | "">("");
  const [petId, setPetId] = useState("");

  const pets = useAllPets();
  const petNames = useMemo(() => new Map((pets.data?.data ?? []).map((p) => [p.id, p.name])), [pets.data]);
  const alerts = useAlerts(
    { page, limit: LIMIT, status: status || undefined, type: type || undefined, petId: petId || undefined },
    caps.hasZones,
  );
  const ack = useAcknowledgeAlert();

  if (caps.isLoading) return <Spinner />;
  if (!caps.hasZones) return <EmptyState title="Este servidor no ofrece alertas de zonas ni de enlace" />;

  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  async function onAck(id: string) {
    try {
      await ack.mutateAsync(id);
    } catch (e) {
      push("error", errorMessage(e));
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Alertas</h1>

      <div className="flex flex-wrap gap-2">
        <select
          className={select}
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value as AlertStatus | "")}
          aria-label="Estado"
        >
          <option value="">Todas</option>
          <option value="active">Activas</option>
          <option value="resolved">Resueltas</option>
        </select>
        <select
          className={select}
          value={type}
          onChange={(e) => resetPage(setType)(e.target.value as AlertType | "")}
          aria-label="Tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="ZONE_EXIT">Salida de zona</option>
          <option value="LINK_LOSS">Pérdida de enlace</option>
        </select>
        <select
          className={select}
          value={petId}
          onChange={(e) => resetPage(setPetId)(e.target.value)}
          aria-label="Mascota"
        >
          <option value="">Todas las mascotas</option>
          {(pets.data?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {alerts.isLoading && <Spinner />}
      {alerts.error && <ErrorBox error={alerts.error} onRetry={() => alerts.refetch()} />}
      {alerts.data && alerts.data.data.length === 0 && <EmptyState title="No hay alertas con estos filtros" />}

      {alerts.data && alerts.data.data.length > 0 && (
        <>
          <ul className="grid gap-3">
            {alerts.data.data.map((a) => {
              const isAckingThis = ack.isPending && ack.variables === a.id;
              return (
                <li key={a.id}>
                  <Card as="article" className={a.status === "active" ? "border-l-4 border-l-red-500" : ""}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={a.type === "LINK_LOSS" ? "red" : "amber"}>{TYPE_LABEL[a.type]}</Badge>
                          <Badge tone={a.status === "active" ? "red" : "green"}>
                            {a.status === "active" ? "Activa" : "Resuelta"}
                          </Badge>
                          {a.acknowledged && <Badge tone="gray">Reconocida</Badge>}
                        </div>
                        <p className="text-sm font-medium">{a.message}</p>
                        <p className="text-xs text-slate-500">
                          <Link href={`/mascotas/${a.petId}`} className="underline">
                            {petNames.get(a.petId) ?? "Mascota"}
                          </Link>{" "}
                          · {formatDateTime(a.triggeredAt)}
                          {a.resolvedAt && ` · resuelta ${formatDateTime(a.resolvedAt)}`}
                        </p>
                      </div>
                      {!a.acknowledged && a.status === "active" && (
                        <Button variant="secondary" onClick={() => onAck(a.id)} disabled={isAckingThis}>
                          {isAckingThis ? "Reconociendo…" : "Reconocer"}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={alerts.data.meta.page}
            limit={alerts.data.meta.limit}
            total={alerts.data.meta.total}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
