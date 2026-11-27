"use client";

import { useNow } from "@/hooks/useNow";
import { formatDistance, timeAgo } from "@/lib/format";
import type { PetMonitoring } from "@/lib/types";

/**
 * Estado del collar para el usuario. El backend decide cuándo hay alerta (con tolerancia a
 * cortes breves); acá solo se muestra: sin enlace, fuera de zona, conectado o sin datos.
 */
export function LinkStatusBanner({ monitoring }: { monitoring: PetMonitoring }) {
  const now = useNow();
  const linkLoss = monitoring.activeAlerts.find((a) => a.type === "LINK_LOSS");
  const zoneExit = monitoring.activeAlerts.find((a) => a.type === "ZONE_EXIT");
  const lastSeen = timeAgo(monitoring.lastSeenAt, now);

  if (!monitoring.deviceId) return null;

  if (linkLoss) {
    return (
      <Banner tone="red" title="Sin enlace con el collar">
        No recibimos señal del collar ({lastSeen}). La última posición conocida puede no ser la actual.
      </Banner>
    );
  }

  if (zoneExit) {
    const outside = monitoring.zones.filter((z) => z.inside === false);
    return (
      <Banner tone="amber" title="Fuera de la zona segura">
        {outside.length > 0
          ? outside.map((z) => `${z.name}: a ${formatDistance(z.distanceMeters)} del centro`).join(" · ")
          : zoneExit.message}
      </Banner>
    );
  }

  if (monitoring.linkStatus === "offline") {
    return (
      <Banner tone="amber" title="Señal intermitente">
        Última señal {lastSeen}. Estamos verificando si se recupera antes de avisarte.
      </Banner>
    );
  }

  if (monitoring.linkStatus === "unknown") {
    return (
      <Banner tone="gray" title="Todavía sin datos">
        El collar aún no reportó su estado.
      </Banner>
    );
  }

  return (
    <Banner tone="green" title="Collar conectado">
      Última señal {lastSeen}
      {monitoring.insideSafeArea === true && " · dentro de la zona segura"}.
    </Banner>
  );
}

function Banner({ tone, title, children }: { tone: "red" | "amber" | "green" | "gray"; title: string; children: React.ReactNode }) {
  const tones = {
    red: "border-red-300 bg-red-50 text-red-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    green: "border-emerald-300 bg-emerald-50 text-emerald-900",
    gray: "border-slate-300 bg-slate-50 text-slate-700",
  };
  return (
    <div role="status" className={`rounded-lg border p-3 text-sm ${tones[tone]}`}>
      <p className="font-semibold">{title}</p>
      <p>{children}</p>
    </div>
  );
}
