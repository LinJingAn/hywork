import type { Href } from "expo-router";

export function getNotificationTapTarget(
  data: Record<string, unknown> | undefined,
): Href {
  if (!data) return "/notifications";

  const url = data.url;
  if (typeof url === "string" && url.startsWith("/")) {
    return url as Href;
  }

  const route = data.route ?? data.screen;
  if (typeof route === "string" && route.startsWith("/")) {
    return route as Href;
  }

  if (data.type === "news" && data.newsId) {
    return {
      pathname: "/notifications",
      params: { highlight: String(data.newsId) },
    } as Href;
  }

  if (typeof data.slug === "string") {
    return {
      pathname: "/contents",
      params: { slug: data.slug },
    } as Href;
  }

  return "/notifications";
}
