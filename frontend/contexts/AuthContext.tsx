"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/useAuth";
import { clearSession, getSessionExpiresAt, peekToken, setSession, subscribeSession } from "@/lib/session";
import type { AuthToken, User } from "@/lib/types";

interface AuthApi {
  token: string | null;
  /** false hasta que se leyó el almacenamiento del navegador (evita redirigir de más). */
  ready: boolean;
  user: User | undefined;
  signIn: (auth: AuthToken) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(subscribeSession, peekToken, () => null);
  // false en el servidor y en la hidratación; true recién en el navegador (evita redirigir de más).
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Si el token se borra (logout o 401), se descarta toda la caché del usuario anterior.
  useEffect(() => {
    if (ready && !token) queryClient.clear();
  }, [ready, token, queryClient]);

  // Cierre proactivo de sesión apenas vence el JWT sin esperar al próximo 401.
  useEffect(() => {
    if (!ready || !token) return;
    const expiresAt = getSessionExpiresAt();
    if (!expiresAt) return;
    const remainingMs = Math.max(0, expiresAt - Date.now());
    const id = setTimeout(() => clearSession(), remainingMs);
    return () => clearTimeout(id);
  }, [ready, token]);

  const me = useMe(!!token);

  const signIn = useCallback(
    (auth: AuthToken) => {
      queryClient.clear();
      setSession(auth.accessToken, auth.expiresIn);
    },
    [queryClient],
  );

  const signOut = useCallback(() => clearSession(), []);

  const value = useMemo(
    () => ({ token, ready, user: me.data, signIn, signOut }),
    [token, ready, me.data, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
