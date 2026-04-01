import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  OAuthProvider,
  User,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { AUTH_API, MICROSOFT_AUTH_PAGE_URL } from '@/config/auth';
import { auth } from '@/config/firebase';

const AUTH_TOKEN_KEY = '@hywork/auth_token';
const AUTH_TENANT_ID_KEY = '@hywork/tenant_id';
const AUTH_COLLAB_ID_KEY = '@hywork/collab_id';
const AUTH_USER_ID_KEY = '@hywork/user_id';

export interface ApiAuthUser {
  email: string;
}

export interface AuthContextData {
  token: string;
  tenantId?: string | null;
  collabId?: string | null;
  userId?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function storeAuthContext(context: AuthContextData): Promise<void> {
  const { token, tenantId, collabId, userId } = context;
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  if (tenantId) {
    await AsyncStorage.setItem(AUTH_TENANT_ID_KEY, tenantId);
  }
  if (collabId && UUID_REGEX.test(collabId)) {
    await AsyncStorage.setItem(AUTH_COLLAB_ID_KEY, collabId);
  }
  if (userId) {
    await AsyncStorage.setItem(AUTH_USER_ID_KEY, userId);
  }
}

export function getStoredAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Try to extract tenantId/collabId from JWT payload (Bearer token).
 */
function extractFromJwtPayload(token: string): {
  tenantId?: string | null;
  collabId?: string | null;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const padded = pad ? b64 + '===='.slice(0, 4 - pad) : b64;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let binary = '';
    for (let i = 0; i < padded.length; i += 4) {
      const a = chars.indexOf(padded[i]);
      const b = chars.indexOf(padded[i + 1]);
      const c = chars.indexOf(padded[i + 2]);
      const d = chars.indexOf(padded[i + 3]);
      if (a < 0 || b < 0) break;
      const n = (a << 18) | (b << 12) | (c >= 0 ? c << 6 : 0) | (d >= 0 ? d : 0);
      binary += String.fromCharCode((n >> 16) & 255);
      if (c >= 0) binary += String.fromCharCode((n >> 8) & 255);
      if (d >= 0) binary += String.fromCharCode(n & 255);
    }
    const payload = JSON.parse(binary) as Record<string, unknown>;
    const tenantId =
      (typeof payload.tenantId === 'string' && payload.tenantId) ||
      (typeof payload.tenant_id === 'string' && payload.tenant_id) ||
      (typeof payload.tid === 'string' && payload.tid) ||
      null;
    let collabId =
      (typeof payload.collabId === 'string' && payload.collabId) ||
      (typeof payload.collab_id === 'string' && payload.collab_id) ||
      (typeof payload.collaboratorId === 'string' && payload.collaboratorId) ||
      null;
    if (collabId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collabId))
      collabId = null;
    return { tenantId: tenantId || null, collabId: collabId || null };
  } catch {
    return {};
  }
}

export async function getStoredAuthContext(): Promise<AuthContextData | null> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  const [storedTenantId, storedCollabId, userId] = await Promise.all([
    AsyncStorage.getItem(AUTH_TENANT_ID_KEY),
    AsyncStorage.getItem(AUTH_COLLAB_ID_KEY),
    AsyncStorage.getItem(AUTH_USER_ID_KEY),
  ]);

  let tenantId = storedTenantId;
  const isValidUuid = (s: string | null) =>
    s && UUID_REGEX.test(s);
  let collabId = isValidUuid(storedCollabId) ? storedCollabId : null;
  if (storedCollabId && !collabId) {
    await AsyncStorage.removeItem(AUTH_COLLAB_ID_KEY);
  }
  if (!tenantId || !collabId) {
    const fromJwt = extractFromJwtPayload(token);
    if (fromJwt.tenantId) tenantId = tenantId || fromJwt.tenantId;
    if (fromJwt.collabId && isValidUuid(fromJwt.collabId))
      collabId = collabId || fromJwt.collabId;
    if (tenantId && !storedTenantId) {
      await AsyncStorage.setItem(AUTH_TENANT_ID_KEY, tenantId);
    }
    if (collabId && !storedCollabId) {
      await AsyncStorage.setItem(AUTH_COLLAB_ID_KEY, collabId);
    }
  }

  return {
    token,
    tenantId,
    collabId,
    userId,
  };
}

export function parseApiErrorMessage(body: unknown): string {
  if (body == null || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  if (typeof b.message === 'string') return b.message;
  if (typeof b.error === 'string') return b.error;
  if (typeof b.detail === 'string') return b.detail;
  if (typeof b.msg === 'string') return b.msg;
  if (Array.isArray(b.errors) && b.errors.length > 0 && typeof b.errors[0] === 'string')
    return b.errors[0];
  return '';
}

interface ParsedAuthApiResponse {
  token: string | null;
  tenantId?: string | null;
  collabId?: string | null;
  userId?: string | null;
}

function findStringField(
  source: Record<string, unknown> | undefined,
  keys: string[]
): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function parseAuthApiResponse(body: unknown): ParsedAuthApiResponse {
  if (body == null || typeof body !== 'object') {
    return { token: null };
  }

  const b = body as Record<string, unknown>;
  const data =
    (b.data && typeof b.data === 'object'
      ? (b.data as Record<string, unknown>)
      : undefined) ??
    (b.result && typeof b.result === 'object'
      ? (b.result as Record<string, unknown>)
      : undefined) ??
    (b.response && typeof b.response === 'object'
      ? (b.response as Record<string, unknown>)
      : undefined) ??
    (b.body && typeof b.body === 'object'
      ? (b.body as Record<string, unknown>)
      : undefined);

  // ✅ Extract nested `data.user` object
  const dataUser =
    data?.user && typeof data.user === 'object'
      ? (data.user as Record<string, unknown>)
      : undefined;

  const token =
    (b.accessToken as string | undefined) ??
    (b.token as string | undefined) ??
    (b.access_token as string | undefined) ??
    (data?.accessToken as string | undefined) ??
    (data?.token as string | undefined) ??
    (data?.access_token as string | undefined) ??
    null;

  // ✅ Also search inside data.user for tenantId
  let tenantId =
    findStringField(b, ['tenantId', 'tenant_id', 'tenant']) ??
    findStringField(data, ['tenantId', 'tenant_id', 'tenant']) ??
    findStringField(dataUser, ['tenantId', 'tenant_id', 'tenant']);

  if (!tenantId) {
    for (const source of [b, data, dataUser]) {
      if (!source) continue;
      for (const key of Object.keys(source)) {
        if (!/tenant/i.test(key)) continue;
        const value = (source as Record<string, unknown>)[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          tenantId = value;
          break;
        }
      }
      if (tenantId) break;
    }
  }

  // ✅ Also search inside data.user.collab for collabId
  const dataUserCollab =
    dataUser?.collab && typeof dataUser.collab === 'object'
      ? (dataUser.collab as Record<string, unknown>)
      : undefined;

  let collabId =
    findStringField(b, ['collabId', 'collaboratorId', 'collab_id', 'collaborator_id']) ??
    findStringField(data, ['collabId', 'collaboratorId', 'collab_id', 'collaborator_id']) ??
    findStringField(dataUser, ['collabId', 'collaboratorId', 'collab_id', 'collaborator_id']) ??
    findStringField(dataUserCollab, ['id', 'collabId', 'collab_id']);  // ✅ data.user.collab.id

  if (!collabId) {
    const collab =
      (b.collaborator && typeof b.collaborator === 'object'
        ? (b.collaborator as Record<string, unknown>)
        : undefined) ||
      (data?.collaborator && typeof data.collaborator === 'object'
        ? (data.collaborator as Record<string, unknown>)
        : undefined) ||
      (b.collab && typeof b.collab === 'object'
        ? (b.collab as Record<string, unknown>)
        : undefined) ||
      (b.user && typeof b.user === 'object'
        ? (b.user as Record<string, unknown>)
        : undefined) ||
      (data?.user && typeof data?.user === 'object'
        ? (data.user as Record<string, unknown>)
        : undefined);
    collabId = findStringField(collab, ['id', 'collabId', 'collab_id']);
  }

  if (!collabId) {
    const rawId = findStringField(b, ['id']) ?? findStringField(data, ['id']);
    if (rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
      collabId = rawId;
    }
  }

  const userId =
    findStringField(b, ['userId', 'user_id']) ??
    findStringField(data, ['userId', 'user_id']) ??
    findStringField(dataUser, ['uid', 'userId', 'user_id']);  // ✅ data.user.uid

  return {
    token,
    tenantId: tenantId ?? null,
    collabId: collabId ?? null,
    userId: userId ?? null,
  };
}

/**
 * Re-call Auth API login with fresh Firebase idToken (per API docs 1.2).
 * Use when stored context is incomplete - returns token, tenantId, collabId.
 */
export async function refreshAuthContextWithFirebase(): Promise<AuthContextData | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(AUTH_API.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;

    const raw = await res.text();
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    let { token, tenantId, collabId, userId } = parseAuthApiResponse(parsed);

    if (__DEV__ && (!tenantId || !collabId)) {
      console.warn(
        '[AUTH DEBUG] Auth API response (missing tenantId/collabId):',
        JSON.stringify(parsed, null, 2)
      );
      console.warn(
        '[AUTH DEBUG] Parsed:',
        { token: !!token, tenantId, collabId, userId }
      );
    }

    if (!token) return null;

    if (!tenantId || !collabId) {
      const fromJwt = extractFromJwtPayload(token);
      tenantId = tenantId ?? fromJwt.tenantId ?? null;
      collabId = collabId ?? fromJwt.collabId ?? null;
    }

    const context: AuthContextData = {
      token,
      tenantId: tenantId ?? null,
      collabId: collabId ?? null,
      userId: userId ?? null,
    };
    await storeAuthContext(context);
    return context;
  } catch {
    return null;
  }
}

async function callAuthApi(
  url: string,
  idToken: string
): Promise<ParsedAuthApiResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    const err = new Error(
      'Verifique sua conexão e tente novamente.'
    ) as Error & { code?: string };
    err.code = 'auth/network-error';
    throw err;
  }

  const raw = await res.text();
  let parsed: unknown = {};
  try {
    parsed = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
  } catch {
    parsed = {};
  }

  if (__DEV__) {
    const { token: t, tenantId: tid, collabId: cid } = parseAuthApiResponse(parsed);
    if (res.ok && (!tid || !cid)) {
      console.warn('[AUTH DEBUG] Initial login - Auth API response:', JSON.stringify(parsed, null, 2));
      console.warn('[AUTH DEBUG] Parsed:', { token: !!t, tenantId: tid, collabId: cid });
    }
  }

  const message = parseApiErrorMessage(parsed);

  if (!res.ok) {
    const err = new Error(message || 'Falha na autenticação.') as Error & {
      code?: string;
    };
    if (res.status === 404) err.code = 'auth/user-not-found';
    else if (res.status === 401 || res.status === 403)
      err.code = 'auth/invalid-credential';
    throw err;
  }

  const { token, tenantId, collabId, userId } = parseAuthApiResponse(parsed);
  if (token) {
    await storeAuthContext({
      token,
      tenantId: tenantId ?? undefined,
      collabId: collabId ?? undefined,
      userId: userId ?? undefined,
    });
  }

  return { token, tenantId, collabId, userId };
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<ApiAuthUser> {
  const trimmedEmail = email.trim();

  let user: User;
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );
    user = credential.user;
  } catch (error) {
    const err = error as Error & { code?: string };
    if (!err.code) {
      err.code = 'auth/invalid-credential';
    }
    throw err;
  }

  const idToken = await user.getIdToken();
  await callAuthApi(AUTH_API.login, idToken);

  return { email: trimmedEmail };
}

export function isNewUser(user: {
  metadata: { creationTime?: string; lastSignInTime?: string };
}): boolean {
  const { creationTime, lastSignInTime } = user.metadata ?? {};
  return !!creationTime && creationTime === lastSignInTime;
}

export async function activateWithPassword(
  email: string,
  password: string
): Promise<ApiAuthUser> {
  const trimmedEmail = email.trim();

  let user: User;
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );
    user = credential.user;
  } catch (error) {
    const err = error as Error & { code?: string };
    throw err;
  }

  const idToken = await user.getIdToken();
  await callAuthApi(AUTH_API.signup, idToken);

  return { email: trimmedEmail };
}

/**
 * Extracts Firebase custom token from `hywork://auth-success?token=...` (query or fragment).
 */
export function extractCustomTokenFromAuthRedirectUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const normalized = url.includes('://')
      ? url
      : `hywork://auth-success${url.startsWith('?') ? url : `?${url}`}`;
    const parsed = new URL(normalized);
    const q = parsed.searchParams.get('token');
    if (q) return decodeURIComponent(q.replace(/\+/g, ' '));
  } catch {
    /* fall through */
  }
  const match = url.match(/(?:[?&#])token=([^&#]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
}

function waitForMicrosoftCustomTokenFromDeepLink(
  authPageUrl: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sub: { remove: () => void } | undefined;
    let timer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub?.remove();
    };

    const tryUrl = (url: string | null) => {
      if (!url || !url.includes('auth-success')) return;
      const token = extractCustomTokenFromAuthRedirectUrl(url);
      if (token) {
        cleanup();
        resolve(token);
      }
    };

    timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        const err = new Error(
          'Tempo esgotado ao aguardar retorno do login Microsoft.'
        ) as Error & { code?: string };
        err.code = 'auth/timeout';
        reject(err);
      }
    }, timeoutMs);

    sub = Linking.addEventListener('url', ({ url }) => tryUrl(url));
    void Linking.getInitialURL().then((url) => tryUrl(url));

    void Linking.openURL(authPageUrl).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

export async function loginWithMicrosoft(): Promise<void> {
  if (Platform.OS === 'web') {
    const provider = new OAuthProvider('microsoft.com');
    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    await callAuthApi(AUTH_API.login, idToken);
    return;
  }

  WebBrowser.maybeCompleteAuthSession();

  const authPageUrl = `${MICROSOFT_AUTH_PAGE_URL}${MICROSOFT_AUTH_PAGE_URL.includes('?') ? '&' : '?'}_app_ts=${Date.now()}`;

  const customToken = await waitForMicrosoftCustomTokenFromDeepLink(
    authPageUrl,
    15 * 60 * 1000
  );

  const credential = await signInWithCustomToken(auth, customToken);
  const idToken = await credential.user.getIdToken();
  await callAuthApi(AUTH_API.login, idToken);
}
