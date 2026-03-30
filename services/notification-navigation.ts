import type { Href } from "expo-router";

import {
  WEBVIEW_DOMAIN_URL,
  WEB_NOTICIAS_PATH_PREFIX,
  WEB_NOTIFICATIONS_PATH,
} from "@/config/auth";

function successWithWebPath(webRedirect: string): Href {
  return {
    pathname: "/success",
    params: { webRedirect },
  } as Href;
}

function pathFromAbsoluteWorkspaceUrl(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    const base = new URL(WEBVIEW_DOMAIN_URL);
    if (parsed.hostname.toLowerCase() !== base.hostname.toLowerCase()) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function getNotificationTapTarget(
  data: Record<string, unknown> | undefined,
): Href {
  if (!data) {
    return successWithWebPath(WEB_NOTIFICATIONS_PATH);
  }

  const webRedirect = data.webRedirect ?? data.web_path;
  if (typeof webRedirect === "string" && webRedirect.startsWith("/")) {
    return successWithWebPath(webRedirect);
  }

  const pathField = data.path;
  if (typeof pathField === "string" && pathField.startsWith("/")) {
    return successWithWebPath(pathField);
  }

  const route = data.route ?? data.screen;
  if (typeof route === "string" && route.startsWith("/")) {
    return successWithWebPath(route);
  }

  const url = data.url;
  if (typeof url === "string") {
    if (url.startsWith("/")) {
      return successWithWebPath(url);
    }
    const fromAbsolute = pathFromAbsoluteWorkspaceUrl(url);
    if (fromAbsolute) {
      return successWithWebPath(fromAbsolute);
    }
  }

  if (typeof data.slug === "string" && data.slug.trim().length > 0) {
    const slug = data.slug.trim();
    const prefix = WEB_NOTICIAS_PATH_PREFIX.replace(/\/$/, "") || "/noticias";
    return successWithWebPath(`${prefix}/${encodeURIComponent(slug)}`);
  }

  return successWithWebPath(WEB_NOTIFICATIONS_PATH);
}
