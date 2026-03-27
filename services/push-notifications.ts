import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { CORE_API_BASE, DEFAULT_TENANT_ID } from "@/config/auth";
import {
  getStoredAuthContext,
  refreshAuthContextWithFirebase,
} from "@/services/auth";

const DEVICE_TOKEN_ENDPOINT = `${CORE_API_BASE}/notifications/device-token`;

const REGISTRATION_MAX_ATTEMPTS = 5;
const REGISTRATION_INITIAL_DELAY_MS = 1000;
const EXPO_TOKEN_FETCH_ATTEMPTS = 3;
const EXPO_TOKEN_INITIAL_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500 && status <= 599;
}

export function getEasProjectId(): string | undefined {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExpoConfig === "string" && fromExpoConfig.length > 0) {
    return fromExpoConfig;
  }
  const fromEas = Constants.easConfig?.projectId;
  if (typeof fromEas === "string" && fromEas.length > 0) {
    return fromEas;
  }
  const manifest2 = Constants.manifest2 as
    | { extra?: { eas?: { projectId?: string } } }
    | undefined;
  const fromManifest = manifest2?.extra?.eas?.projectId;
  if (typeof fromManifest === "string" && fromManifest.length > 0) {
    return fromManifest;
  }
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_EAS_PROJECT_ID === "string"
      ? process.env.EXPO_PUBLIC_EAS_PROJECT_ID.trim()
      : "";
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  return undefined;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "HyWork",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F97316",
  });
}

function getNotificationPlatform(): "ANDROID" | "IOS" | "WEB" {
  if (Platform.OS === "android") return "ANDROID";
  if (Platform.OS === "ios") return "IOS";
  return "WEB";
}

function getDeviceInfo(): Record<string, string | null> {
  return {
    brand: Device.brand ?? null,
    modelName: Device.modelName ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    deviceName: Device.deviceName ?? null,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getPushToken(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  if (__DEV__ && !Device.isDevice) {
    console.warn(
      "[Push] Simulator/emulator: push may not deliver; test on a physical device for reliable dev/production parity.",
    );
  }

  try {
    const native = await Notifications.getDevicePushTokenAsync();
    if (native?.data) return native.data;
  } catch {
    /* fallback to Expo token (dev client + production builds) */
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn(
      "[Push] EAS projectId not found (app.json extra.eas.projectId or EXPO_PUBLIC_EAS_PROJECT_ID); Expo push token may fail in dev and release builds.",
    );
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < EXPO_TOKEN_FETCH_ATTEMPTS; attempt++) {
    try {
      const expo = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      if (expo?.data) return expo.data;
    } catch (err) {
      lastError = err;
      if (attempt < EXPO_TOKEN_FETCH_ATTEMPTS - 1) {
        await sleep(EXPO_TOKEN_INITIAL_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  console.warn(
    "[Push] getExpoPushTokenAsync failed after retries (use a dev/production build with expo-notifications, EAS projectId, and a real device where required):",
    lastError,
  );
  return null;
}

type RegisterAttemptResult =
  | { ok: true }
  | { ok: false; reason: "no_auth" }
  | { ok: false; reason: "network"; message: string }
  | { ok: false; reason: "http"; status: number; body: string };

async function registerPushTokenOnce(
  token: string,
): Promise<RegisterAttemptResult> {
  const context = await getStoredAuthContext();
  if (!context?.token) return { ok: false, reason: "no_auth" };
  let tenantId = context.tenantId ?? DEFAULT_TENANT_ID;
  if (!tenantId && context.token) {
    const refreshed = await refreshAuthContextWithFirebase();
    tenantId = refreshed?.tenantId ?? DEFAULT_TENANT_ID ?? null;
  }
  if (!tenantId) return { ok: false, reason: "no_auth" };

  const platform = getNotificationPlatform();
  const device_info = getDeviceInfo();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    "Content-Type": "application/json",
    "x-tenant-id": tenantId,
  };
  if (context.collabId) headers["x-collab-id"] = context.collabId;

  let res: Response;
  try {
    res = await fetch(DEVICE_TOKEN_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        registrationType: "push",
        token,
        platform,
        device_info,
      }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "network", message };
  }

  if (res.ok) return { ok: true };

  const body = await res.text();
  return { ok: false, reason: "http", status: res.status, body };
}

export async function registerTokenWithBackend(token: string): Promise<void> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < REGISTRATION_MAX_ATTEMPTS; attempt++) {
    const result = await registerPushTokenOnce(token);
    if (result.ok) return;
    if (result.reason === "no_auth") return;

    if (result.reason === "http") {
      if (!isTransientHttpStatus(result.status)) {
        if (__DEV__) {
          console.warn(
            "[Push] registerToken failed (non-retryable):",
            result.status,
            result.body,
          );
        } else {
          console.warn(
            "[Push] registerToken failed (non-retryable):",
            result.status,
          );
        }
        return;
      }
      lastError = __DEV__
        ? `${result.status} ${result.body}`
        : `http ${result.status}`;
    } else if (result.reason === "network") {
      lastError = result.message;
    }

    if (attempt < REGISTRATION_MAX_ATTEMPTS - 1) {
      const delay = REGISTRATION_INITIAL_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  console.warn("[Push] registerToken failed after retries:", lastError);
}
