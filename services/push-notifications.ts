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
  if (!Device.isDevice && !__DEV__) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice && !__DEV__) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  try {
    const native = await Notifications.getDevicePushTokenAsync();
    if (native?.data) return native.data;
  } catch {
    /* fallback to Expo token */
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const expo = await Notifications.getExpoPushTokenAsync({ projectId });
    return expo?.data ?? null;
  } catch {
    return null;
  }
}

export async function registerTokenWithBackend(token: string): Promise<void> {
  const context = await getStoredAuthContext();
  if (!context?.token) return;
  let tenantId = context.tenantId ?? DEFAULT_TENANT_ID;
  if (!tenantId && context.token) {
    const refreshed = await refreshAuthContextWithFirebase();
    tenantId = refreshed?.tenantId ?? DEFAULT_TENANT_ID ?? null;
  }
  if (!tenantId) return;

  const platform = getNotificationPlatform();
  const device_info = getDeviceInfo();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    "Content-Type": "application/json",
    "x-tenant-id": tenantId,
  };
  if (context.collabId) headers["x-collab-id"] = context.collabId;

  const res = await fetch(DEVICE_TOKEN_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ token, platform, device_info }),
  });
  if (!res.ok && __DEV__) {
    console.warn("[Push] registerToken failed:", res.status, await res.text());
  }
}
