/**
 * Auth API base URL per API Documentation Authentication.md
 * Validates Firebase idToken and returns Bearer token + tenantId + collabId
 */
const AUTH_API_BASE =
  'https://hw-cloud-authenticator-1cd72b9a454a.herokuapp.com';

export const AUTH_API = {
  login: `${AUTH_API_BASE}/auth/login`,
  microsoft: `${AUTH_API_BASE}/auth/microsoft`,
  signup: `${AUTH_API_BASE}/auth/login`,
} as const;

/**
 * URL of the hosted page that runs the Microsoft OAuth redirect flow.
 * Deploy auth-page/auth/microsoft.html to Firebase Hosting at /auth/microsoft.html
 * (e.g. public dir = auth-page) and set EXPO_PUBLIC_MICROSOFT_AUTH_PAGE_URL if needed.
 */
export const MICROSOFT_AUTH_PAGE_URL: string =
  process.env?.EXPO_PUBLIC_MICROSOFT_AUTH_PAGE_URL?.trim() ||
  'https://cloud---homolog.web.app/auth/microsoft.html';

/**
 * Core API base URL per API Documentation (NEXT_PUBLIC_API_CORE_URL_PROD)
 * All requests require: Authorization: Bearer <token>, x-tenant-id: <tenantId>
 */
export const CORE_API_BASE = 'https://api-core.hywork.cloud';

/**
 * Fallback tenant id when Auth API does not return tenant.
 * Set EXPO_PUBLIC_DEFAULT_TENANT_ID in .env, or set YOUR_TENANT_ID below.
 */
const YOUR_TENANT_ID = ''; // Set your tenant UUID here if you get "Tenant ID não encontrado"

export const DEFAULT_TENANT_ID: string | null =
  (process.env?.EXPO_PUBLIC_DEFAULT_TENANT_ID?.trim() || null) ||
  (YOUR_TENANT_ID?.trim() || null) ||
  null;

/**
 * Base URL of the Builder/workspace for WebView auto-login (Auto Login WebView Intranet.pdf).
 * Set EXPO_PUBLIC_WEBVIEW_DOMAIN_URL in .env to override.
 */
export const WEBVIEW_DOMAIN_URL: string =
  process.env?.EXPO_PUBLIC_WEBVIEW_DOMAIN_URL?.trim() ||
  'https://meu.hywork.cloud';
