import type { FormikHelpers } from "formik";

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  message?: string | string[];
  errors?: FieldError[];
}

/** Error de la API traducido desde RFC 9457 (application/problem+json). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Mensajes claros para los códigos más comunes; no se muestran detalles internos. */
const FRIENDLY: Record<string, string> = {
  INVALID_CREDENTIALS: "Email o contraseña incorrectos.",
  EMAIL_ALREADY_EXISTS: "Ya existe una cuenta con ese email.",
  EMAIL_TAKEN: "Ya existe una cuenta con ese email.",
  PET_NOT_FOUND: "No se encontró la mascota.",
  ZONE_NOT_FOUND: "No se encontró la zona segura.",
  ALERT_NOT_FOUND: "No se encontró la alerta.",
  NO_LINKED_DEVICES: "Todavía no vinculaste ningún collar.",
  DEVICE_ALREADY_LINKED: "Ese collar ya está vinculado a otra mascota.",
  PET_ALREADY_HAS_DEVICE: "Esta mascota ya tiene un collar vinculado.",
};

export function buildProblemMessage(status: number, body: ProblemBody | null): { code: string; message: string } {
  const code = body?.code ?? `HTTP_${status}`;
  if (FRIENDLY[code]) return { code, message: FRIENDLY[code] };
  if (status === 401) return { code, message: "Tu sesión expiró. Iniciá sesión de nuevo." };
  if (status === 403) return { code, message: "No tenés permiso para hacer esto." };
  if (status === 404) return { code, message: body?.detail ?? "No se encontró el recurso." };
  if (status === 409) return { code, message: body?.detail ?? "Conflicto con el estado actual del recurso." };
  if (status === 429) return { code, message: "Demasiados pedidos. Esperá un momento e intentá de nuevo." };
  if (status >= 500) return { code, message: "El servicio no está disponible por el momento. Intentá más tarde." };
  const nest = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
  return { code, message: body?.detail ?? nest ?? "No se pudo completar la operación." };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "El servidor tardó demasiado en responder. Intentá de nuevo.";
  }
  if (error instanceof TypeError) return "No se pudo conectar con el servidor. Revisá tu conexión.";
  return "Ocurrió un error inesperado.";
}

/**
 * Propaga errores de campo RFC 9457 (ApiError.fieldErrors) a Formik y deja el
 * resumen general en `status` para mostrarlo en el formulario.
 */
export function applyApiErrors<T extends object>(
  error: unknown,
  helpers: Pick<FormikHelpers<T>, "setFieldError" | "setStatus">,
  allowedFields?: ReadonlyArray<Extract<keyof T, string>>,
): void {
  if (error instanceof ApiError && error.fieldErrors.length > 0) {
    let mappedAny = false;
    for (const fe of error.fieldErrors) {
      if (!allowedFields || allowedFields.includes(fe.field as Extract<keyof T, string>)) {
        helpers.setFieldError(fe.field, fe.message);
        mappedAny = true;
      }
    }
    if (mappedAny) {
      helpers.setStatus(error.message);
      return;
    }
  }
  helpers.setStatus(errorMessage(error));
}
