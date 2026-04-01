/**
 * Auth API base URL per API Documentation Authentication.md
 * Validates Firebase idToken and returns Bearer token + tenantId + collabId
 */
const AUTH_API_BASE =
  "https://hw-cloud-authenticator-1cd72b9a454a.herokuapp.com";

export const AUTH_API = {
  login: `${AUTH_API_BASE}/auth/login`,
  microsoft: `${AUTH_API_BASE}/auth/microsoft`,
  signup: `${AUTH_API_BASE}/auth/login`,
} as const;

/**
 * Hosted page for Microsoft OAuth (Firebase Auth redirect + custom token for the app).
 * If you see Firebase "Site Not Found", run `firebase deploy --only hosting` (see auth-page/README.md).
 */
/** Use firebaseapp.com host so OAuth return matches authDomain (fewer redirect/session issues than web.app). */
export const MICROSOFT_AUTH_PAGE_URL: string =
  process.env?.EXPO_PUBLIC_MICROSOFT_AUTH_PAGE_URL?.trim() ||
  "https://cloud---homolog.firebaseapp.com/auth/microsoft.html";

/**
 * Core API base URL per API Documentation (NEXT_PUBLIC_API_CORE_URL_PROD)
 * All requests require: Authorization: Bearer <token>, x-tenant-id: <tenantId>
 */
export const CORE_API_BASE = "https://api-core.hywork.cloud";

/**
 * Fallback tenant id when Auth API does not return tenant.
 * Set EXPO_PUBLIC_DEFAULT_TENANT_ID in .env, or set YOUR_TENANT_ID below.
 */
const YOUR_TENANT_ID = ""; // Set your tenant UUID here if you get "Tenant ID não encontrado"

export const DEFAULT_TENANT_ID: string | null =
  process.env?.EXPO_PUBLIC_DEFAULT_TENANT_ID?.trim() ||
  null ||
  YOUR_TENANT_ID?.trim() ||
  null ||
  null;

/**
 * Base URL of the Builder/workspace for WebView auto-login (Auto Login WebView Intranet.pdf).
 * Set EXPO_PUBLIC_WEBVIEW_DOMAIN_URL in .env to override.
 */
export const WEBVIEW_DOMAIN_URL: string =
  process.env?.EXPO_PUBLIC_WEBVIEW_DOMAIN_URL?.trim() ||
  "https://meu.hywork.cloud";

export const WEB_NOTIFICATIONS_PATH: string =
  process.env?.EXPO_PUBLIC_WEB_NOTIFICATIONS_PATH?.trim() || "/notifications";

export const WEB_NOTICIAS_PATH_PREFIX: string =
  process.env?.EXPO_PUBLIC_WEB_NOTICIAS_PATH_PREFIX?.trim() || "/noticias";

/** Resolve relative avatar URLs from the Core API (profile thumb, etc.). */
export const MEDIA_BASE_URL: string =
  process.env?.EXPO_PUBLIC_MEDIA_BASE_URL?.trim() || WEBVIEW_DOMAIN_URL;
