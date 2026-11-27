"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function AppSegmentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto my-8 grid max-w-md gap-3 text-center">
      <h1 className="text-lg font-semibold text-slate-900">No se pudo mostrar esta vista</h1>
      <p className="text-sm text-slate-600">
        Se produjo un error inesperado en esta sección. Intentá recargarla o volvé al mapa principal.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Button onClick={reset}>Reintentar</Button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Volver al mapa
        </Link>
      </div>
    </Card>
  );
}
