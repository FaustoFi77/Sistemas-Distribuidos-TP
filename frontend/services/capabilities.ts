import { ApiError, request } from "@/services/http";
import type { Capabilities } from "@/lib/types";

/** Si el backend no implementa /capabilities (404) se opera en modo base: variants = []. */
export async function getCapabilities(): Promise<Capabilities> {
  try {
    const caps = await request<Capabilities>("/capabilities", { auth: false });
    return { apiVersion: caps?.apiVersion ?? "1", variants: Array.isArray(caps?.variants) ? caps.variants : [] };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { apiVersion: "1", variants: [] };
    throw error;
  }
}
