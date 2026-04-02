import { CORE_API_BASE, MEDIA_BASE_URL } from "@/config/auth";

export type ImageAuth = {
  token: string;
  tenantId: string | null;
  collabId: string | null;
  userId?: string | null;
};

export interface ProfileApiResponse {
  id: string;
  name: string;
  email: string;
  thumb?: string | null;
  thumbnail?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
  photo?: string | null;
  description?: string | null;
  phone?: string | null;
  birthday?: string | null;
  hire_date?: string | null;
  job_title?: string | null;
  jobTitle?: string | null;
  position?: string | null;
  occupation?: string | null;
  role_name?: string | null;
  department?: string | { name?: string | null } | null;
  department_name?: string | null;
  access_level?: { name?: string | null } | null;
  organizational_structures?:
    | {
        id?: string | null;
        name?: string | null;
        type?: string | null;
        thumb?: string | null;
        thumbnail?: string | null;
        logo?: string | null;
        abbreviation?: string | null;
        short_name?: string | null;
        initials?: string | null;
        sigla?: string | null;
      }[]
    | null;
  occupations?: unknown[] | null;
}

const PROTECTED_MEDIA_PATH_RE =
  /\/(collabs|collaborators|avatars?|thumb|thumbnail|uploads|media|files|storage)\b/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProtectedMediaPath(pathname: string): boolean {
  return PROTECTED_MEDIA_PATH_RE.test(pathname);
}

export function resolveMediaUrl(
  raw: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("data:")) return t;
  const origin = baseUrl.replace(/\/+$/, "");
  const coreOrigin = CORE_API_BASE.replace(/\/+$/, "");
  if (UUID_RE.test(t)) {
    return `${coreOrigin}/files/${encodeURIComponent(t)}`;
  }
  if (t.startsWith("/")) {
    if (isProtectedMediaPath(t)) {
      return `${coreOrigin}${t}`;
    }
    return `${origin}${t}`;
  }
  if (isProtectedMediaPath(`/${t}`)) {
    return `${coreOrigin}/${t}`;
  }
  return `${origin}/${t}`;
}

export function shouldAttachAuthHeaders(uri: string): boolean {
  try {
    const url = new URL(uri);
    const protocol = url.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    const coreHost = new URL(CORE_API_BASE).hostname.toLowerCase();
    const mediaHost = new URL(MEDIA_BASE_URL).hostname.toLowerCase();
    if (host === coreHost || host === mediaHost) return true;
    if (host.endsWith("hywork.cloud") || host.endsWith("hywork.com"))
      return true;
    return isProtectedMediaPath(url.pathname);
  } catch {
    return false;
  }
}

export function buildAuthenticatedImageSource(
  uri: string,
  auth: ImageAuth | null | undefined,
): { uri: string; headers?: Record<string, string> } {
  if (!auth?.token) return { uri };
  if (!shouldAttachAuthHeaders(uri)) return { uri };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
  };
  if (auth.tenantId) headers["x-tenant-id"] = auth.tenantId;
  if (auth.collabId) headers["x-collab-id"] = auth.collabId;
  if (auth.userId) headers["x-user-id"] = auth.userId;
  return { uri, headers };
}

export function extractAvatarUrlFromProfile(
  profile: ProfileApiResponse | null,
): string | null {
  if (!profile) return null;
  const raw = profile as unknown as Record<string, unknown>;
  const tryStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const fromObj = (v: unknown): string | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const directKeys = [
      "url",
      "uri",
      "src",
      "href",
      "path",
      "location",
      "key",
      "filename",
      "thumb",
      "thumbnail",
      "avatar",
      "avatar_url",
      "photo",
      "photo_url",
      "image",
      "image_url",
    ];
    for (const k of directKeys) {
      const s = tryStr(o[k]);
      if (s) return s;
    }
    const nestedKeys = [
      "file",
      "asset",
      "media",
      "image",
      "thumb",
      "thumbnail",
    ];
    for (const k of nestedKeys) {
      const nested = o[k];
      const s = fromObj(nested);
      if (s) return s;
    }
    return null;
  };
  const candidates: unknown[] = [
    profile.thumbnail,
    profile.thumb,
    profile.avatar_url,
    profile.photo_url,
    profile.photo,
    raw.thumbnail,
    raw.thumb,
    raw.avatar,
    raw.avatarFile,
    raw.avatar_file,
    raw.picture,
    raw.photo,
    raw.image,
    raw.file,
    raw.media,
    raw.image_url,
    raw.profile_picture,
    raw.profilePicture,
  ];
  for (const c of candidates) {
    const fromObject = fromObj(c);
    if (fromObject) return fromObject;
    const s = tryStr(c);
    if (s) return s;
  }
  return null;
}

export function normalizeAvatarUrl(
  profile: ProfileApiResponse | null,
  baseUrl: string,
): string | null {
  const raw = extractAvatarUrlFromProfile(profile);
  if (!raw) return null;
  return resolveMediaUrl(raw, baseUrl);
}
