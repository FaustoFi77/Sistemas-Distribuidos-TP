"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Form, Formik, type FormikHelpers } from "formik";
import { AuthCard } from "@/components/AuthCard";
import { Button, Spinner } from "@/components/ui";
import { FormField } from "@/components/ui/FormField";
import { useAuth } from "@/contexts/AuthContext";
import { useRegister } from "@/hooks/useAuth";
import { applyApiErrors } from "@/lib/errors";
import { registerSchema, validateWith, type RegisterValues } from "@/lib/schemas";

const REGISTER_FIELDS = ["name", "email", "password"] as const;

export default function RegistroPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const registerMutation = useRegister();

  useEffect(() => {
    if (ready && token) router.replace("/");
  }, [ready, token, router]);

  if (!ready || token) return <Spinner label="Verificando sesión…" />;

  async function onSubmit(values: RegisterValues, helpers: FormikHelpers<RegisterValues>) {
    helpers.setStatus("");
    try {
      await registerMutation.mutateAsync(registerSchema.parse(values));
      router.replace("/");
    } catch (error) {
      applyApiErrors(error, helpers, REGISTER_FIELDS);
    }
  }

  return (
    <AuthCard title="Crear cuenta">
      <Formik<RegisterValues>
        initialValues={{ name: "", email: "", password: "" }}
        validate={validateWith(registerSchema)}
        onSubmit={onSubmit}
      >
        {({ isSubmitting, status }) => (
          <Form noValidate className="grid gap-4">
            <FormField<RegisterValues> name="name" label="Nombre" autoComplete="name" />
            <FormField<RegisterValues> name="email" label="Email" type="email" autoComplete="email" />
            <FormField<RegisterValues>
              name="password"
              label="Contraseña (mínimo 8 caracteres)"
              type="password"
              autoComplete="new-password"
            />
            {status && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                {status}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting || registerMutation.isPending}>
              {isSubmitting || registerMutation.isPending ? "Creando…" : "Registrarme"}
            </Button>
            <Link href="/login" className="text-center text-sm text-slate-600 underline">
              Ya tengo cuenta
            </Link>
          </Form>
        )}
      </Formik>
    </AuthCard>
  );
}
