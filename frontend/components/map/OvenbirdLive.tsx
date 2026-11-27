"use client";

/**
 * ÚNICO archivo que toca `@ovenbird/react`.
 * Usa las firmas tipadas reales del SDK (`node_modules/@ovenbird/react/dist/index.d.ts`)
 * y pide el embed token al backend a través del hook `useEmbedToken()`.
 */

import { useCallback } from "react";
import {
  BatteryIndicator,
  DeviceMap,
  OnlineBadge,
  OvenbirdProvider,
  useDeviceStatus,
  type MapZone,
} from "@ovenbird/react";
import { useEmbedToken } from "@/hooks/usePets";
import { OVENBIRD_URL } from "@/lib/config";
import { applyLeafletUnmountGuard } from "@/lib/leafletGuard";

applyLeafletUnmountGuard();

function DeviceStatusPanel({ deviceId }: { deviceId: string }) {
  const { status, online, loading, error } = useDeviceStatus(deviceId);
  const rawBattery = status?.dps?.battery_pct?.value;
  const batteryPct = typeof rawBattery === "number" ? rawBattery : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {loading && !status ? (
          <span className="text-slate-500">Consultando estado en vivo del collar…</span>
        ) : (
          <>
            <OnlineBadge online={online} lastSeenAt={status?.lastSeenAt ?? null} />
            <BatteryIndicator pct={batteryPct} />
          </>
        )}
      </div>
      {error && (
        <span role="alert" className="text-xs text-amber-700">
          No se pudo leer la telemetría en vivo desde Ovenbird ({error.message}). Verificá que este origen esté
          autorizado en Ovenbird.
        </span>
      )}
    </div>
  );
}

export default function OvenbirdLive({
  deviceIds,
  selectedDeviceId,
  zones,
  onSelectDevice,
}: {
  deviceIds: string[];
  selectedDeviceId: string | null;
  zones?: MapZone[];
  onSelectDevice?: (deviceId: string) => void;
}) {
  const { mutateAsync } = useEmbedToken();

  const getEmbedToken = useCallback(async (): Promise<string> => {
    const res = await mutateAsync(undefined);
    return res.token;
  }, [mutateAsync]);

  return (
    <OvenbirdProvider baseUrl={OVENBIRD_URL} getToken={getEmbedToken}>
      <div className="grid gap-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DeviceMap
            deviceIds={deviceIds}
            followDeviceId={selectedDeviceId ?? undefined}
            showTrail
            trailMinutes={30}
            height={480}
            onMarkerClick={onSelectDevice}
            zones={zones}
          />
        </div>
        {selectedDeviceId && <DeviceStatusPanel deviceId={selectedDeviceId} />}
      </div>
    </OvenbirdProvider>
  );
}
