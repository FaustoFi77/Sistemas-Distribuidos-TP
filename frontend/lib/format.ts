export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "sin datos";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "sin datos";
  if (now <= 0) return "…";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "hace instantes";
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR");
}

/**
 * Formatea una fecha sin hora (ej. birthDate `YYYY-MM-DD`) sin corrimiento por zona horaria.
 * Evita que `new Date("2023-05-10")` se muestre como 9/5 en UTC-3.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const local = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(local.getTime()) ? "—" : local.toLocaleDateString("es-AR");
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-AR");
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export const SPECIES_LABEL: Record<string, string> = { dog: "Perro", cat: "Gato", other: "Otro" };
