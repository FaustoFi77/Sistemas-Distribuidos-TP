import { request } from "@/services/http";
import type { AuthToken, LoginInput, RegisterInput, User } from "@/lib/types";

export const login = (body: LoginInput) =>
  request<AuthToken>("/auth/login", { method: "POST", body, auth: false });

export const register = (body: RegisterInput) =>
  request<AuthToken>("/auth/register", { method: "POST", body, auth: false });

export const getMe = () => request<User>("/auth/me");
