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

const NESTED_PAYLOAD_KEYS = [
  "metadata",
  "data",
  "payload",
  "news",
  "content",
  "entity",
  "resource",
  "notification",
] as const;

export function resolveWebRedirectPathFromPayload(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;

  const leaf = tryResolvePathFromSingleRecord(data);
  if (leaf) return leaf;

  for (const key of NESTED_PAYLOAD_KEYS) {
    const nested = data[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const p = resolveWebRedirectPathFromPayload(
        nested as Record<string, unknown>,
      );
      if (p) return p;
    }
  }

  return null;
}

function tryResolvePathFromSingleRecord(
  data: Record<string, unknown>,
): string | null {
  const webRedirect = data.webRedirect ?? data.web_path;
  if (typeof webRedirect === "string" && webRedirect.startsWith("/")) {
    return webRedirect;
  }

  const pathField = data.path ?? data.url_path;
  if (typeof pathField === "string" && pathField.startsWith("/")) {
    return pathField;
  }

  const route = data.route ?? data.screen;
  if (typeof route === "string" && route.startsWith("/")) {
    return route;
  }

  const url =
    data.url ??
    data.link ??
    data.href ??
    data.action_url ??
    data.actionUrl ??
    data.deep_link ??
    data.deepLink ??
    data.target_url;
  if (typeof url === "string") {
    if (url.startsWith("/")) {
      return url;
    }
    const fromAbsolute = pathFromAbsoluteWorkspaceUrl(url);
    if (fromAbsolute) {
      return fromAbsolute;
    }
  }

  const slug =
    (typeof data.slug === "string" && data.slug) ||
    (typeof data.news_slug === "string" && data.news_slug) ||
    (typeof data.newsSlug === "string" && data.newsSlug) ||
    null;
  if (slug && slug.trim().length > 0) {
    const s = slug.trim();
    const prefix = WEB_NOTICIAS_PATH_PREFIX.replace(/\/$/, "") || "/noticias";
    return `${prefix}/${encodeURIComponent(s)}`;
  }

  return null;
}

export function getNotificationTapTarget(
  data: Record<string, unknown> | undefined,
): Href {
  return successWithWebPath(
    resolveWebRedirectPathFromPayload(data) ?? WEB_NOTIFICATIONS_PATH,
  );
}
