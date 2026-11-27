export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1").replace(/\/+$/, "");
export const OVENBIRD_URL = process.env.NEXT_PUBLIC_OVENBIRD_URL ?? "https://iotplatform.ovenbirdconsulting.com.ar";

/** Identificador oficial de la variante de este grupo (ver GET /capabilities). */
export const VARIANT_ZONES = "link-loss-zones";
