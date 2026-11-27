"use client";

import { Form, Formik, type FormikHelpers } from "formik";
import { Button, Modal } from "@/components/ui";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/contexts/ToastContext";
import { useCreatePet, useUpdatePet } from "@/hooks/usePets";
import { applyApiErrors } from "@/lib/errors";
import { petSchema, validateWith, type PetValues } from "@/lib/schemas";
import type { Pet, PetInput } from "@/lib/types";

const PET_FIELDS = ["name", "species", "breed", "birthDate"] as const;

export function PetFormModal({ pet, onClose }: { pet?: Pet; onClose: () => void }) {
  const create = useCreatePet();
  const update = useUpdatePet();
  const { push } = useToast();

  const initial: PetValues = {
    name: pet?.name ?? "",
    species: pet?.species ?? "dog",
    breed: pet?.breed ?? "",
    birthDate: pet?.birthDate ? pet.birthDate.slice(0, 10) : "",
  };

  async function onSubmit(values: PetValues, helpers: FormikHelpers<PetValues>) {
    helpers.setStatus("");
    try {
      const parsed = petSchema.parse(values);
      if (pet) {
        const body: Partial<PetInput> = {
          name: parsed.name,
          species: parsed.species,
          breed: parsed.breed ? parsed.breed : null,
          birthDate: parsed.birthDate ? parsed.birthDate : null,
        };
        await update.mutateAsync({ petId: pet.id, body });
      } else {
        const body: PetInput = { name: parsed.name, species: parsed.species };
        if (parsed.breed) body.breed = parsed.breed;
        if (parsed.birthDate) body.birthDate = parsed.birthDate;
        await create.mutateAsync(body);
      }
      push("success", pet ? "Mascota actualizada." : "Mascota creada.");
      onClose();
    } catch (error) {
      applyApiErrors(error, helpers, PET_FIELDS);
    }
  }

  return (
    <Modal title={pet ? "Editar mascota" : "Nueva mascota"} onClose={onClose}>
      <Formik<PetValues> initialValues={initial} validate={validateWith(petSchema)} onSubmit={onSubmit}>
        {({ isSubmitting, dirty, status }) => (
          <Form noValidate className="grid gap-4">
            <FormField<PetValues> name="name" label="Nombre" />
            <FormField<PetValues> name="species" label="Especie" as="select">
              <option value="dog">Perro</option>
              <option value="cat">Gato</option>
              <option value="other">Otro</option>
            </FormField>
            <FormField<PetValues> name="breed" label="Raza (opcional)" />
            <FormField<PetValues> name="birthDate" label="Fecha de nacimiento (opcional)" type="date" />
            {status && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                {status}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || create.isPending || update.isPending || (!!pet && !dirty)}
              >
                {isSubmitting ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
