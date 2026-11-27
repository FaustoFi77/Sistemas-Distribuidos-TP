"use client";

import { useId, type ReactNode } from "react";
import { useField } from "formik";

const baseInput =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2";
const normalInput = `${baseInput} border-slate-300 focus:border-slate-500 focus:ring-slate-200`;
const errorInput = `${baseInput} border-red-500 focus:border-red-600 focus:ring-red-200`;

export function FormField<Values extends object = Record<string, unknown>>({
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  step,
  as,
  children,
}: {
  name: Extract<keyof Values, string>;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  step?: string;
  as?: "select";
  children?: ReactNode;
}) {
  const [field, meta] = useField(name);
  const errorId = useId();
  const error = meta.touched && meta.error ? meta.error : undefined;
  const className = error ? errorInput : normalInput;

  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      {as === "select" ? (
        <select
          {...field}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={className}
        >
          {children}
        </select>
      ) : (
        <input
          {...field}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={className}
        />
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs font-normal text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
