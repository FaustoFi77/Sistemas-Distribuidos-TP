import { API_URL } from "@/lib/config";
import { ApiError, buildProblemMessage, errorMessage, type ProblemBody } from "@/lib/errors";
import { clearSession, getToken } from "@/lib/session";

export { ApiError, errorMessage };

const REQUEST_TIMEOUT_MS = 15_000;

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** false para endpoints públicos (login, registro, capabilities). */
  auth?: boolean;
}

function withTimeoutSignal(callerSignal?: AbortSignal | null): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return callerSignal ?? undefined;
  }
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (callerSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([callerSignal, timeoutSignal]);
  }
  return callerSignal ?? timeoutSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, signal, ...init } = options;
  const finalHeaders: Record<string, string> = { Accept: "application/json", ...(headers as Record<string, string>) };

  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    signal: withTimeoutSignal(signal),
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* cuerpo vacío o no JSON */
  }

  if (!response.ok) {
    const problem = (data ?? null) as ProblemBody | null;
    if (response.status === 401 && auth) clearSession(); // el guard redirige a /login
    const { code, message } = buildProblemMessage(response.status, problem);
    throw new ApiError(response.status, code, message, problem?.errors ?? []);
  }

  return data as T;
}

/** Querystring que omite valores vacíos. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
