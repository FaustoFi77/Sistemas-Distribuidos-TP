"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function GlobalErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="grid max-w-md gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Algo salió mal</h1>
        <p className="text-sm text-slate-600">
          Ocurrió un error inesperado al cargar esta pantalla. Podés reintentar o volver al inicio.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={reset}>Reintentar</Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Ir al inicio
          </Link>
        </div>
      </Card>
    </main>
  );
}
