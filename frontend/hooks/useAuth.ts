"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { setSession } from "@/lib/session";
import type { LoginInput, RegisterInput } from "@/lib/types";
import { getMe, login, register } from "@/services/auth";

export const useMe = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    enabled,
    staleTime: 5 * 60_000,
  });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginInput) => login(body),
    onSuccess: (auth) => {
      qc.clear();
      setSession(auth.accessToken, auth.expiresIn);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterInput) => register(body),
    onSuccess: (auth) => {
      qc.clear();
      setSession(auth.accessToken, auth.expiresIn);
    },
  });
}
