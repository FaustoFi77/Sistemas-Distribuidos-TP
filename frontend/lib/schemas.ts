import type { FormikErrors } from "formik";
import { z } from "zod";

export function validateWith<T extends z.ZodType>(schema: T) {
  return (values: unknown): FormikErrors<Record<string, unknown>> => {
    const result = schema.safeParse(values);
    if (result.success) return {};
    const errors: FormikErrors<Record<string, unknown>> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return errors;
  };
}

/**
 * Convierte texto o número de un input numérico rechazando strings vacíos o solo espacios
 * (evita que `Number("") === 0` deje pasar coordenadas vacías como (0, 0)).
 */
function requiredNumber(requiredMessage: string, invalidMessage: string) {
  return z.preprocess(
    (value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") return undefined;
        return Number(trimmed);
      }
      return value;
    },
    z
      .number({
        error: (issue) => (issue.input === undefined ? requiredMessage : invalidMessage),
      })
      .refine((n) => Number.isFinite(n), invalidMessage),
  );
}

const emailField = z.string().trim().pipe(z.email("Email inválido"));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Ingresá tu contraseña"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Ingresá tu nombre").max(100, "Máximo 100 caracteres"),
  email: emailField,
  password: z.string().min(8, "Mínimo 8 caracteres").max(128, "Máximo 128 caracteres"),
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const petSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre").max(100, "Máximo 100 caracteres"),
  species: z.enum(["dog", "cat", "other"]),
  breed: z.string().trim().max(100, "Máximo 100 caracteres").optional(),
  birthDate: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Fecha inválida"),
});
export type PetValues = z.infer<typeof petSchema>;

export const zoneSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre").max(100, "Máximo 100 caracteres"),
  centerLat: requiredNumber("Ingresá la latitud o tocá el mapa", "Latitud inválida")
    .pipe(z.number().min(-90, "Entre -90 y 90").max(90, "Entre -90 y 90")),
  centerLon: requiredNumber("Ingresá la longitud o tocá el mapa", "Longitud inválida")
    .pipe(z.number().min(-180, "Entre -180 y 180").max(180, "Entre -180 y 180")),
  radiusMeters: requiredNumber("Ingresá el radio en metros", "Radio inválido")
    .pipe(z.number().min(10, "Mínimo 10 m").max(50000, "Máximo 50000 m")),
});

export type ZoneFormValues = {
  name: string;
  centerLat: string | number;
  centerLon: string | number;
  radiusMeters: string | number;
};
