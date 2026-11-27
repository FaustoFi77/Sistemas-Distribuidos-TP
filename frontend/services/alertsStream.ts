import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source";
import { API_URL } from "@/lib/config";
import { clearSession, getToken } from "@/lib/session";

class FatalStreamError extends Error {}

export interface AlertsStreamHandlers {
  fallbackToken: string;
  signal: AbortSignal;
  onOpen: () => void;
  onEvent: (event: string, payload: unknown) => void;
}

/**
 * Abre la conexión SSE autenticada (`/alerts/stream`).
 * Se usa `@microsoft/fetch-event-source` porque el `EventSource` nativo no admite el header `Authorization`.
 */
export function openAlertsStream({ fallbackToken, signal, onOpen, onEvent }: AlertsStreamHandlers): void {
  fetchEventSource(`${API_URL}/alerts/stream`, {
    signal,
    headers: { Accept: "text/event-stream" },
    openWhenHidden: true,
    // Re-lee el token vigente en cada reconexión para no reutilizar un JWT vencido.
    fetch: (input, init) => {
      const currentToken = getToken() ?? fallbackToken;
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${currentToken}`);
      return fetch(input, { ...init, headers });
    },

    async onopen(res) {
      if (res.ok && res.headers.get("content-type")?.startsWith(EventStreamContentType)) {
        onOpen();
        return;
      }
      if (res.status === 401) {
        clearSession();
        throw new FatalStreamError("401");
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new FatalStreamError(`HTTP ${res.status}`);
      }
      throw new Error(`HTTP ${res.status}`);
    },

    onmessage(msg) {
      if (!msg.data) return;
      let payload: unknown;
      try {
        payload = JSON.parse(msg.data);
      } catch {
        return; // dato corrupto: se descarta sin romper el stream
      }
      onEvent(msg.event, payload);
    },

    onerror(err) {
      if (err instanceof FatalStreamError) throw err;
      return 3000;
    },
  }).catch(() => {
    /* FatalStreamError: ya se limpió la sesión o no corresponde reintentar */
  });
}
