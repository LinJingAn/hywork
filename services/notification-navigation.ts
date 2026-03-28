import type { Href } from "expo-router";

export function getNotificationTapTarget(
  _data: Record<string, unknown> | undefined,
): Href {
  return "/notifications";
}
