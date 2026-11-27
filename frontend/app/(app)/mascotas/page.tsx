"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, Pagination, Spinner } from "@/components/ui";
import { PetFormModal } from "@/components/PetFormModal";
import { useToast } from "@/contexts/ToastContext";
import { useDeletePet, usePets } from "@/hooks/usePets";
import { errorMessage } from "@/lib/errors";
import { SPECIES_LABEL } from "@/lib/format";
import type { Pet } from "@/lib/types";

const LIMIT = 12;

export default function MascotasPage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Pet | "new" | null>(null);
  const [deleting, setDeleting] = useState<Pet | null>(null);
  const { data, isLoading, error, refetch } = usePets(page, LIMIT);
  const del = useDeletePet();
  const { push } = useToast();

  async function confirmDelete() {
    if (!deleting) return;
    const pet = deleting;
    try {
      await del.mutateAsync(pet.id);
      push("success", `${pet.name} fue eliminada.`);
      setDeleting(null);
      if (data && data.data.length === 1 && page > 1) setPage(page - 1);
    } catch (e) {
      push("error", errorMessage(e));
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis mascotas</h1>
        <Button onClick={() => setEditing("new")}>+ Nueva mascota</Button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBox error={error} onRetry={() => refetch()} />}

      {data && data.data.length === 0 && (
        <EmptyState title="Todavía no cargaste ninguna mascota">Creá la primera para vincularle un collar.</EmptyState>
      )}

      {data && data.data.length > 0 && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((pet) => {
              const isDeletingThis = del.isPending && del.variables === pet.id;
              return (
                <li key={pet.id}>
                  <Card as="article" className="flex h-full flex-col gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{pet.name}</h2>
                      <p className="text-sm text-slate-500">
                        {SPECIES_LABEL[pet.species] ?? pet.species}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </p>
                    </div>
                    <div>
                      {pet.deviceId ? <Badge tone="blue">Collar vinculado</Badge> : <Badge tone="gray">Sin collar</Badge>}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link
                        href={`/mascotas/${pet.id}`}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                      >
                        Ver
                      </Link>
                      <Button variant="secondary" onClick={() => setEditing(pet)}>
                        Editar
                      </Button>
                      <Button variant="danger" onClick={() => setDeleting(pet)} disabled={isDeletingThis}>
                        {isDeletingThis ? "Eliminando…" : "Eliminar"}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.meta.page} limit={data.meta.limit} total={data.meta.total} onChange={setPage} />
        </>
      )}

      {editing && <PetFormModal pet={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}

      {deleting && (
        <ConfirmModal
          title={`Eliminar a ${deleting.name}`}
          message="Esta acción no se puede deshacer. Si tiene un collar vinculado, se desvinculará automáticamente."
          confirmLabel="Eliminar"
          pending={del.isPending}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
