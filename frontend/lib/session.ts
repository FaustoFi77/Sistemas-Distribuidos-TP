// Sesión en localStorage con suscripción (para useSyncExternalStore).
// El accessToken es un JWT del backend: NO es un secreto de la plataforma Ovenbird.

const KEY = "mascotas.session";

interface Stored {
  token: string;
  expiresAt: number; // epoch ms
}

const listeners = new Set<() => void>();

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Lectura sin efectos secundarios (apta para useSyncExternalStore). */
export function peekToken(): string | null {
  if (typeof window === "undefined") return null;
  const s = read();
  if (!s || Date.now() >= s.expiresAt) return null;
  return s.token;
}

/** Epoch ms de vencimiento de la sesión vigente, o null si no hay sesión activa. */
export function getSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const s = read();
  if (!s || Date.now() >= s.expiresAt) return null;
  return s.expiresAt;
}

/** Devuelve el token vigente; si venció, limpia la sesión guardada. */
export function getToken(): string | null {
  const token = peekToken();
  if (!token && typeof window !== "undefined" && read()) clearSession();
  return token;
}

export function setSession(token: string, expiresInSeconds: number): void {
  try {
    const value: Stored = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que dure la pestaña */
  }
  listeners.forEach((l) => l());
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
