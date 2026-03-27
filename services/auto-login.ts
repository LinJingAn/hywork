/**
 * Auto-login WebView flow per Auto Login WebView Intranet.pdf
 * 1. Call POST /auth/auto-login/generate
 * 2. Open returned loginUrl in WebView (with device=app)
 * 3. Builder /auth/auto does exchange, Firebase login, set-cookies, redirect
 */

import * as Device from "expo-device";
import { Platform } from "react-native";

import { CORE_API_BASE, DEFAULT_TENANT_ID } from "@/config/auth";
import { getStoredAuthContext, refreshAuthContextWithFirebase } from "./auth";

const AUTO_LOGIN_GENERATE = `${CORE_API_BASE}/auth/auto-login/generate`;
const AUTO_LOGIN_REGISTER_DEVICE = `${CORE_API_BASE}/notifications/device-token`;

export interface GenerateAutoLoginParams {
  email: string;
  domainUrl: string;
  redirectUrl?: string;
  tenantId?: string | null;
  idToken?: string | null;
}

export interface GenerateAutoLoginResult {
  loginUrl: string;
  token: string;
  expiresInSeconds: number;
}

// ✅ Returns 'ANDROID' | 'IOS' | 'WEB' based on actual runtime platform
function getDevicePlatform(): string {
  if (Platform.OS === "android") return "ANDROID";
  if (Platform.OS === "ios") return "IOS";
  return "WEB";
}

// ✅ Returns real device model name e.g. "Pixel 6", "iPhone 14 Pro"
// Falls back to a safe string if running in simulator or value is unavailable
function getDeviceModel(): string {
  return Device.modelName ?? Device.deviceName ?? "Unknown";
}

// ✅ Returns OS version string e.g. "14", "17.2"
function getOsVersion(): string {
  return Device.osVersion ?? Platform.Version?.toString() ?? "Unknown";
}

/**
 * Calls Core API generate endpoint. Returns loginUrl to open in WebView.
 * Append &device=app per PDF recommendation.
 */
export async function generateAutoLoginUrl(
  params: GenerateAutoLoginParams,
): Promise<GenerateAutoLoginResult> {
  const { email, domainUrl, redirectUrl = "/", tenantId, idToken } = params;

  const context = await getStoredAuthContext();
  let resolvedTenantId = tenantId ?? context?.tenantId ?? DEFAULT_TENANT_ID;
  let resolvedCollabId = context?.collabId ?? "";

  if (!resolvedTenantId) {
    const refreshed = await refreshAuthContextWithFirebase();
    resolvedTenantId = refreshed?.tenantId ?? DEFAULT_TENANT_ID ?? null;
  }

  if (!resolvedTenantId) {
    throw new Error("Tenant ID não encontrado. Faça login novamente.");
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error("E-mail do usuário é obrigatório.");
  }

  const trimmedDomain = domainUrl.replace(/\/$/, "");
  if (!trimmedDomain) {
    throw new Error("domainUrl é obrigatório.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant-id": resolvedTenantId,
  };

  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const res = await fetch(AUTO_LOGIN_GENERATE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: trimmedEmail,
      domainUrl: trimmedDomain,
      redirectUrl: redirectUrl.startsWith("/")
        ? redirectUrl
        : `/${redirectUrl}`,
    }),
  });

  const raw = await res.text();
  const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

  if (!res.ok) {
    const msg =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      "Falha ao gerar link de auto-login.";
    throw new Error(msg);
  }

  const loginUrl = typeof body.loginUrl === "string" ? body.loginUrl : "";
  const token = typeof body.token === "string" ? body.token : "";
  const expiresInSeconds =
    typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : 300;

  if (!loginUrl || !token) {
    throw new Error("Resposta inválida do servidor de auto-login.");
  }

  const urlWithDevice = loginUrl.includes("?")
    ? `${loginUrl}${loginUrl.includes("device=") ? "" : "&device=app"}`
    : `${loginUrl}?device=app`;

  const registerRes = await fetch(AUTO_LOGIN_REGISTER_DEVICE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-tenant-id": resolvedTenantId,
      "x-collab-id": resolvedCollabId,
    },
    body: JSON.stringify({
      registrationType: "auto_login",
      token,
      platform: getDevicePlatform(),
      device_info: {
        model: getDeviceModel(),
        osVersion: getOsVersion(),
      },
    }),
  });

  if (!registerRes.ok) {
    const errText = await registerRes.text();
    if (__DEV__) {
      console.warn(
        "[Auto-login] device-token registration failed (non-fatal):",
        registerRes.status,
        errText,
      );
    }
  }

  return {
    loginUrl: urlWithDevice,
    token,
    expiresInSeconds,
  };
}
