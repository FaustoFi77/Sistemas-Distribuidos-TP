"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useNow } from "@/hooks/useNow";
import { useCreatePairingCode, useDevices, useLinkDevice } from "@/hooks/usePets";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";

function Countdown({ expiresAt }: { expiresAt: string }) {
  const now = useNow(1000);
  if (now <= 0) return <span>Calculando…</span>;
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return left > 0 ? <span>Vence en {mm}:{ss}</span> : <span className="font-medium text-red-600">Código vencido</span>;
}

/** Genera el código de emparejamiento y permite asociar el collar detectado a la mascota. */
export function PairingPanel({ petId }: { petId: string }) {
  const { push } = useToast();
  const pairing = useCreatePairingCode();
  const link = useLinkDevice();
  const [pendingDevice, setPendingDevice] = useState("");
  const [expiredCode, setExpiredCode] = useState<string | null>(null);
  const listNow = useNow(15_000);

  const code = pairing.data;
  const expired = Boolean(code && expiredCode === code.code);

  useEffect(() => {
    if (!code) return;
    const remainingMs = Math.max(0, new Date(code.expiresAt).getTime() - Date.now());
    const id = setTimeout(() => setExpiredCode(code.code), remainingMs);
    return () => clearTimeout(id);
  }, [code]);

  // Mientras hay un código vigente, TanStack Query consulta cada 5 s para detectar el collar nuevo.
  const devices = useDevices(true, code && !expired ? 5_000 : false);
  const free = (devices.data?.data ?? []).filter((d) => d.petId === null);

  async function onLink() {
    if (!pendingDevice) return;
    try {
      await link.mutateAsync({ petId, deviceId: pendingDevice });
      push("success", "Collar vinculado.");
    } catch (error) {
      push("error", errorMessage(error));
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Vincular un collar</h2>

      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Generá un código de emparejamiento.</li>
        <li>
          Abrí la app <strong>Ovenbird Smart</strong> e ingresá el código para sumar la unidad.
        </li>
        <li>Cuando el collar aparezca abajo, elegilo y tocá “Vincular”.</li>
      </ol>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => pairing.mutate(undefined)} disabled={pairing.isPending}>
          {code ? "Generar otro código" : "Generar código"}
        </Button>
        {code && (
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-lg tracking-widest text-white">
              {code.code}
            </span>
            <span className="text-sm text-slate-500">
              <Countdown expiresAt={code.expiresAt} />
            </span>
          </div>
        )}
      </div>
      {pairing.error && <ErrorBox error={pairing.error} />}

      <h3 className="mb-2 text-sm font-semibold text-slate-700">Collares disponibles</h3>
      {devices.isLoading && <Spinner label="Buscando collares…" />}
      {devices.error && <ErrorBox error={devices.error} onRetry={() => devices.refetch()} />}
      {devices.data && free.length === 0 && (
        <p className="text-sm text-slate-500">
          Todavía no apareció ningún collar libre. Se actualiza solo cada pocos segundos.
        </p>
      )}
      {free.length > 0 && (
        <div className="grid gap-2">
          {free.map((d) => (
            <label
              key={d.deviceId}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm has-[:checked]:border-slate-900"
            >
              <input
                type="radio"
                name="device"
                value={d.deviceId}
                checked={pendingDevice === d.deviceId}
                onChange={() => setPendingDevice(d.deviceId)}
              />
              <span className="flex-1">
                <span className="font-medium">{d.name}</span>
                <span className="block text-xs text-slate-500">
                  {d.deviceId} · visto {timeAgo(d.lastSeenAt, listNow)}
                </span>
              </span>
              <Badge tone={d.online ? "green" : "gray"}>{d.online ? "En línea" : "Sin conexión"}</Badge>
            </label>
          ))}
          <Button onClick={onLink} disabled={!pendingDevice || link.isPending}>
            {link.isPending ? "Vinculando…" : "Vincular a esta mascota"}
          </Button>
        </div>
      )}
    </Card>
  );
}
