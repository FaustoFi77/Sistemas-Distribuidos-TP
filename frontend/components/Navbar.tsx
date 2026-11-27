"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useAlerts } from "@/hooks/useZones";

export function Navbar() {
  const pathname = usePathname();
  const { ready, user, signOut } = useAuth();
  const { push } = useToast();
  const { hasZones } = useCapabilities();
  const active = useAlerts({ status: "active", limit: 1 }, hasZones);
  const activeCount = active.data?.meta.total ?? 0;
  const [notifChecked, setNotifChecked] = useState(false);

  const canAskNotifications =
    ready &&
    hasZones &&
    !notifChecked &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default";

  async function onEnableNotifications() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotifChecked(true);
    if (permission === "granted") push("success", "Notificaciones del navegador activadas.");
    else if (permission === "denied") push("info", "Notificaciones bloqueadas en el navegador.");
  }

  const links = [
    { href: "/", label: "Mapa" },
    { href: "/mascotas", label: "Mascotas" },
    ...(hasZones ? [{ href: "/alertas", label: "Alertas" }] : []),
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold text-slate-900">
          <span aria-hidden="true">🐾 </span>Seguimiento de mascotas
        </Link>
        <nav className="flex flex-1 items-center gap-1 text-sm" aria-label="Principal">
          {links.map((l) => {
            const current = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`relative rounded-lg px-3 py-1.5 ${
                  current ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {l.label}
                {l.href === "/alertas" && activeCount > 0 && (
                  <span
                    aria-label={`${activeCount} alertas activas`}
                    className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
                  >
                    {activeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          {canAskNotifications && (
            <button
              type="button"
              onClick={onEnableNotifications}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50"
            >
              Activar avisos
            </button>
          )}
          <span className="hidden sm:inline">{user?.name ?? user?.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
