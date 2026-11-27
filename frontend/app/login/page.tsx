"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Form, Formik, type FormikHelpers } from "formik";
import { AuthCard } from "@/components/AuthCard";
import { Button, Spinner } from "@/components/ui";
import { FormField } from "@/components/ui/FormField";
import { useAuth } from "@/contexts/AuthContext";
import { useLogin } from "@/hooks/useAuth";
import { applyApiErrors } from "@/lib/errors";
import { loginSchema, validateWith, type LoginValues } from "@/lib/schemas";

const LOGIN_FIELDS = ["email", "password"] as const;

export default function LoginPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const loginMutation = useLogin();

  useEffect(() => {
    if (ready && token) router.replace("/");
  }, [ready, token, router]);

  if (!ready || token) return <Spinner label="Verificando sesión…" />;

  async function onSubmit(values: LoginValues, helpers: FormikHelpers<LoginValues>) {
    helpers.setStatus("");
    try {
      await loginMutation.mutateAsync(loginSchema.parse(values));
      router.replace("/");
    } catch (error) {
      applyApiErrors(error, helpers, LOGIN_FIELDS);
    }
  }

  return (
    <AuthCard title="Iniciar sesión">
      <Formik<LoginValues>
        initialValues={{ email: "", password: "" }}
        validate={validateWith(loginSchema)}
        onSubmit={onSubmit}
      >
        {({ isSubmitting, status }) => (
          <Form noValidate className="grid gap-4">
            <FormField<LoginValues> name="email" label="Email" type="email" autoComplete="email" />
            <FormField<LoginValues>
              name="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
            />
            {status && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                {status}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting || loginMutation.isPending}>
              {isSubmitting || loginMutation.isPending ? "Ingresando…" : "Entrar"}
            </Button>
            <Link href="/registro" className="text-center text-sm text-slate-600 underline">
              Crear una cuenta
            </Link>
          </Form>
        )}
      </Formik>
    </AuthCard>
  );
}
