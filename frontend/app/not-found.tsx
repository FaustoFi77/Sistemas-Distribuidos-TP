import Link from "next/link";
import { btn, Card } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="grid max-w-md gap-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">404</p>
        <h1 className="text-xl font-semibold text-slate-900">Página no encontrada</h1>
        <p className="text-sm text-slate-600">La dirección que buscaste no existe o fue movida.</p>
        <div className="pt-2">
          <Link href="/" className={`${btn.base} ${btn.primary}`}>
            Volver al inicio
          </Link>
        </div>
      </Card>
    </main>
  );
}
