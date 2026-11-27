"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useAlertsStream } from "@/hooks/useAlertsStream";
import { useCapabilities } from "@/hooks/useCapabilities";

/** Guard de rutas + conexión SSE única para toda la zona autenticada. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, ready } = useAuth();
  const { hasZones } = useCapabilities();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  useAlertsStream(hasZones);

  if (!ready || !token) return <Spinner label="Verificando sesión…" />;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl p-4">{children}</main>
    </>
  );
}
