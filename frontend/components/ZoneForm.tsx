"use client";

import { useEffect } from "react";
import { Form, Formik, useFormikContext, type FormikHelpers } from "formik";
import { Button } from "@/components/ui";
import { FormField } from "@/components/ui/FormField";
import type { Draft } from "@/components/map/ZoneMap";
import { applyApiErrors } from "@/lib/errors";
import { validateWith, zoneSchema, type ZoneFormValues } from "@/lib/schemas";
import type { LastLocation, SafeZone, ZoneInput } from "@/lib/types";

export interface PickedPoint {
  lat: number;
  lon: number;
  n: number;
}

const ZONE_FIELDS = ["name", "centerLat", "centerLon", "radiusMeters"] as const;

/** Conecta el formulario con el mapa: recibe el punto tocado y publica el borrador del círculo. */
function MapSync({ picked, onDraft }: { picked: PickedPoint | null; onDraft: (d: Draft | null) => void }) {
  const { values, setFieldValue } = useFormikContext<ZoneFormValues>();

  useEffect(() => {
    if (!picked) return;
    setFieldValue("centerLat", picked.lat.toFixed(6));
    setFieldValue("centerLon", picked.lon.toFixed(6));
  }, [picked, setFieldValue]);

  useEffect(() => {
    const latText = String(values.centerLat ?? "").trim();
    const lonText = String(values.centerLon ?? "").trim();
    const radiusText = String(values.radiusMeters ?? "").trim();
    const filled = latText !== "" && lonText !== "" && radiusText !== "";
    const lat = Number(latText);
    const lon = Number(lonText);
    const radius = Number(radiusText);
    const valid =
      filled &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Number.isFinite(radius) &&
      radius > 0 &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180;
    onDraft(valid ? { lat, lon, radius } : null);
  }, [values.centerLat, values.centerLon, values.radiusMeters, onDraft]);

  useEffect(() => () => onDraft(null), [onDraft]);

  return null;
}

export function ZoneForm({
  zone,
  picked,
  lastLocation,
  onDraft,
  onSubmit,
  onCancel,
}: {
  zone: SafeZone | null;
  picked: PickedPoint | null;
  lastLocation: LastLocation | null;
  onDraft: (d: Draft | null) => void;
  onSubmit: (input: ZoneInput) => Promise<void>;
  onCancel: () => void;
}) {
  const initial: ZoneFormValues = {
    name: zone?.name ?? "",
    centerLat: zone ? String(zone.centerLat) : "",
    centerLon: zone ? String(zone.centerLon) : "",
    radiusMeters: zone ? String(zone.radiusMeters) : "100",
  };

  async function submit(values: ZoneFormValues, helpers: FormikHelpers<ZoneFormValues>) {
    helpers.setStatus("");
    try {
      const parsed = zoneSchema.parse(values);
      await onSubmit(parsed);
      if (!zone) helpers.resetForm();
    } catch (error) {
      applyApiErrors(error, helpers, ZONE_FIELDS);
    }
  }

  return (
    <Formik<ZoneFormValues>
      initialValues={initial}
      enableReinitialize
      validate={validateWith(zoneSchema)}
      onSubmit={submit}
    >
      {({ isSubmitting, dirty, status, setFieldValue }) => (
        <Form noValidate className="grid gap-3">
          <MapSync picked={picked} onDraft={onDraft} />
          <h2 className="font-semibold">{zone ? `Editar “${zone.name}”` : "Nueva zona segura"}</h2>
          <p className="text-xs text-slate-500">Tocá el mapa para ubicar el centro, o completá las coordenadas.</p>

          <FormField<ZoneFormValues> name="name" label="Nombre" placeholder="Casa, Plaza, Veterinaria…" />
          <div className="grid grid-cols-2 gap-3">
            <FormField<ZoneFormValues> name="centerLat" label="Latitud" step="any" type="number" />
            <FormField<ZoneFormValues> name="centerLon" label="Longitud" step="any" type="number" />
          </div>
          <FormField<ZoneFormValues> name="radiusMeters" label="Radio (metros)" type="number" step="any" />

          {lastLocation && (
            <Button
              variant="secondary"
              onClick={() => {
                setFieldValue("centerLat", lastLocation.lat.toFixed(6));
                setFieldValue("centerLon", lastLocation.lon.toFixed(6));
              }}
            >
              Usar la última posición del collar
            </Button>
          )}

          {status && (
            <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
              {status}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting || (!!zone && !dirty)} className="flex-1">
              {isSubmitting ? "Guardando…" : zone ? "Guardar cambios" : "Crear zona"}
            </Button>
            {zone && (
              <Button variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </Form>
      )}
    </Formik>
  );
}
