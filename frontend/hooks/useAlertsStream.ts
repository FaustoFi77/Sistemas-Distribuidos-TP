"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import type { AlertItem, LinkStatus, MonitoringUpdate, PetMonitoring } from "@/lib/types";
import { openAlertsStream } from "@/services/alertsStream";

function deriveLinkStatus(update: MonitoringUpdate, fallback: LinkStatus): LinkStatus {
  if (update.collarOnline === false || update.bridgeOnline === false) return "offline";
  if (update.collarOnline === true || update.bridgeOnline === true) return "online";
  return fallback;
}

/**
 * Una única conexión SSE por sesión. Los eventos actualizan la caché de TanStack Query
 * y, si el usuario habilitó notificaciones del navegador, avisa en segundo plano.
 */
export function useAlertsStream(enabled: boolean) {
  const qc = useQueryClient();
  const { token } = useAuth();
  const { push } = useToast();
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !token) return;
    const ctrl = new AbortController();

    openAlertsStream({
      fallbackToken: token,
      signal: ctrl.signal,
      onOpen: () => {
        // Al (re)conectar se resincroniza lo ocurrido durante el corte.
        qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
        qc.invalidateQueries({ queryKey: queryKeys.monitoring.all });
      },
      onEvent: (event, payload) => {
        if (event === "alert.created") {
          const alert = payload as AlertItem;
          qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
          qc.invalidateQueries({ queryKey: queryKeys.monitoring.byPet(alert.petId) });
          push("warning", alert.message);

          if (
            typeof document !== "undefined" &&
            document.hidden &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            !notifiedIds.current.has(alert.id)
          ) {
            notifiedIds.current.add(alert.id);
            new Notification(alert.type === "LINK_LOSS" ? "Pérdida de enlace" : "Salida de zona segura", {
              body: alert.message,
              tag: alert.id,
            });
          }
        } else if (event === "alert.resolved") {
          const alert = payload as AlertItem;
          qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
          qc.invalidateQueries({ queryKey: queryKeys.monitoring.byPet(alert.petId) });
          push("success", `Resuelta: ${alert.message}`);
        } else if (event === "monitoring.updated") {
          const m = payload as MonitoringUpdate;
          if (m.deviceId === null) {
            qc.invalidateQueries({ queryKey: queryKeys.monitoring.byPet(m.petId) });
            return;
          }
          const prev = qc.getQueryData<PetMonitoring>(queryKeys.monitoring.byPet(m.petId));
          const locationChanged =
            Boolean(m.lastLocation) && m.lastLocation?.ts !== prev?.lastLocation?.ts;

          qc.setQueryData<PetMonitoring>(queryKeys.monitoring.byPet(m.petId), (old) =>
            old
              ? {
                  ...old,
                  deviceId: m.deviceId,
                  collarOnline: m.collarOnline,
                  bridgeOnline: m.bridgeOnline,
                  lastSeenAt: m.lastSeenAt,
                  lastLocation: m.lastLocation ?? old.lastLocation,
                  linkStatus: deriveLinkStatus(m, old.linkStatus),
                }
              : old,
          );

          // Si cambió la posición, refresca también la evaluación de distancia/dentro-fuera por zona.
          if (locationChanged) {
            qc.invalidateQueries({ queryKey: queryKeys.monitoring.byPet(m.petId) });
          }
        }
      },
    });

    return () => ctrl.abort();
  }, [enabled, token, qc, push]);
}
