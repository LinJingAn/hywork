import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CORE_API_BASE,
  DEFAULT_TENANT_ID,
  MEDIA_BASE_URL,
} from '@/config/auth';
import { auth } from '@/config/firebase';
import { AccountDropdownMenu } from '@/components/app-header';
import { useProfileName } from '@/contexts/profile-name-context';
import { SideDrawer } from '@/components/side-drawer';
import {
  getStoredAuthContext,
  refreshAuthContextWithFirebase,
} from '@/services/auth';

const AUTH_TENANT_ID_KEY = '@hywork/tenant_id';

const HEADER_PINK = '#EC4899';
const TAB_TEAL = '#0D9488';
const PROFILE_AVATAR_SIZE = 100;
const HEADER_HEIGHT = 180;

type ProfileTabId = 'about' | 'testimonials';

function firstNameFromFullName(fullName: string): string {
  const p = fullName.trim().split(/\s+/).filter(Boolean);
  return p[0] ?? '';
}

interface ProfileApiResponse {
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
  access_level?:
    | {
        name?: string | null;
      }
    | null;
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

interface TestimonialApiResponse {
  id: string;
  message?: string | null;
  text?: string | null;
  content?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  from?:
    | {
        name?: string | null;
      }
    | null;
}

interface ProfileGroup {
  id: string;
  name: string;
  logoUrl: string | null;
  initials: string;
}

interface ProfileViewData {
  name: string;
  jobTitle: string;
  department: string;
  organization: string;
  groups: ProfileGroup[];
  email: string;
  admissionDate: string;
  birthday: string;
  phone: string;
  bio: string;
  avatarUrl: string | null;
}

function parseCalendarDateLocal(isoDate?: string | null): Date | null {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const t = isoDate.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const date = new Date(y, mo, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(t);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(isoDate?: string | null): string {
  const date = parseCalendarDateLocal(isoDate);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatBirthday(isoDate?: string | null): string {
  const date = parseCalendarDateLocal(isoDate);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

type ImageAuth = {
  token: string;
  tenantId: string | null;
  collabId: string | null;
  userId?: string | null;
};

const PROTECTED_MEDIA_PATH_RE =
  /\/(collabs|collaborators|avatars?|thumb|thumbnail|uploads|media|files|storage)\b/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProtectedMediaPath(pathname: string): boolean {
  return PROTECTED_MEDIA_PATH_RE.test(pathname);
}

function resolveMediaUrl(
  raw: string | null | undefined,
  baseUrl: string
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('data:')) return t;
  const origin = baseUrl.replace(/\/+$/, '');
  const coreOrigin = CORE_API_BASE.replace(/\/+$/, '');
  if (UUID_RE.test(t)) {
    return `${coreOrigin}/files/${encodeURIComponent(t)}`;
  }
  if (t.startsWith('/')) {
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

function shouldAttachAuthHeaders(uri: string): boolean {
  try {
    const url = new URL(uri);
    const protocol = url.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return false;

    const host = url.hostname.toLowerCase();
    const coreHost = new URL(CORE_API_BASE).hostname.toLowerCase();
    const mediaHost = new URL(MEDIA_BASE_URL).hostname.toLowerCase();
    if (host === coreHost || host === mediaHost) return true;
    if (host.endsWith('hywork.cloud') || host.endsWith('hywork.com')) return true;
    return isProtectedMediaPath(url.pathname);
  } catch {
    return false;
  }
}

function buildAuthenticatedImageSource(
  uri: string,
  auth: ImageAuth | null | undefined
): { uri: string; headers?: Record<string, string> } {
  if (!auth?.token) return { uri };
  if (!shouldAttachAuthHeaders(uri)) return { uri };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
  };
  if (auth.tenantId) headers['x-tenant-id'] = auth.tenantId;
  if (auth.collabId) headers['x-collab-id'] = auth.collabId;
  if (auth.userId) headers['x-user-id'] = auth.userId;
  return { uri, headers };
}

function extractAvatarUrlFromProfile(
  profile: ProfileApiResponse | null
): string | null {
  if (!profile) return null;
  const raw = profile as unknown as Record<string, unknown>;
  const tryStr = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  const fromObj = (v: unknown): string | null => {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const directKeys = [
      'url',
      'uri',
      'src',
      'href',
      'path',
      'location',
      'key',
      'filename',
      'thumb',
      'thumbnail',
      'avatar',
      'avatar_url',
      'photo',
      'photo_url',
      'image',
      'image_url',
    ];
    for (const k of directKeys) {
      const s = tryStr(o[k]);
      if (s) return s;
    }
    const nestedKeys = ['file', 'asset', 'media', 'image', 'thumb', 'thumbnail'];
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

function normalizeAvatarUrl(
  profile: ProfileApiResponse | null,
  baseUrl: string
): string | null {
  const raw = extractAvatarUrlFromProfile(profile);
  if (!raw) return null;
  return resolveMediaUrl(raw, baseUrl);
}

function extractGroupImageUrl(s: Record<string, unknown>): string | null {
  const keys = [
    'thumb',
    'thumbnail',
    'logo',
    'avatar_url',
    'photo_url',
    'image',
    'image_url',
  ];
  for (const k of keys) {
    const v = s[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function initialsForGroup(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const w = parts[0];
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w[0].toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function mapStructuresToGroups(
  structures: ProfileApiResponse['organizational_structures'],
  baseUrl: string
): ProfileGroup[] {
  if (!structures?.length) return [];
  return structures
    .map((entry, i) => {
      const s = entry as unknown as Record<string, unknown>;
      const name =
        (typeof entry?.name === 'string' && entry.name.trim()) ||
        (typeof s.name === 'string' && s.name.trim()) ||
        '';
      const thumbRaw = extractGroupImageUrl(s);
      const logoUrl = thumbRaw ? resolveMediaUrl(thumbRaw, baseUrl) : null;
      const sigla =
        (typeof s.abbreviation === 'string' && s.abbreviation.trim()) ||
        (typeof s.short_name === 'string' && s.short_name.trim()) ||
        (typeof s.initials === 'string' && s.initials.trim()) ||
        (typeof s.sigla === 'string' && s.sigla.trim()) ||
        '';
      const initials =
        sigla.length >= 1
          ? sigla.replace(/\s+/g, '').slice(0, 2).toUpperCase()
          : initialsForGroup(name);
      const id =
        (typeof s.id === 'string' && s.id) || `org-${i}-${name || 'g'}`;
      return { id, name, logoUrl, initials };
    })
    .filter((g) => g.name.length > 0);
}

function departmentFromOccupation(occ: Record<string, unknown> | null): string {
  if (!occ) return '';
  const d = occ.department;
  if (typeof d === 'string' && d.trim()) return d.trim();
  if (d && typeof d === 'object' && typeof (d as { name?: string }).name === 'string') {
    return (d as { name: string }).name.trim();
  }
  const dn = occ.department_name;
  if (typeof dn === 'string' && dn.trim()) return dn.trim();
  return '';
}

function titleFromOccupation(occ: Record<string, unknown> | null): string {
  if (!occ) return '';
  for (const key of ['title', 'position', 'name', 'job_title', 'role_name']) {
    const v = occ[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function departmentFromTypedStructures(
  structures: ProfileApiResponse['organizational_structures']
): string {
  if (!structures?.length) return '';
  const isGroup = (typeRaw: string | null | undefined) => {
    const t = (typeRaw ?? '').toString().toLowerCase().trim();
    return /\b(group|grupo|company|empresa|tenant|matriz)\b/.test(t);
  };
  const isDept = (typeRaw: string | null | undefined) => {
    const t = (typeRaw ?? '').toString().toLowerCase().trim();
    if (!t || isGroup(t)) return false;
    return /\b(department|departamento|setor|área|area|division|unidade|product|produto)\b/.test(
      t
    );
  };
  const typed = structures.filter((s) => s?.type && isDept(s.type));
  const names = (typed.length ? typed : [])
    .map((s) => (typeof s?.name === 'string' ? s.name.trim() : ''))
    .filter(Boolean);
  if (names.length) return names.join(' | ');
  const anyType = structures.some((s) => (s?.type ?? '').toString().trim());
  if (!anyType) return '';
  const nonGroup = structures.filter((s) => !isGroup(s?.type));
  return nonGroup
    .map((s) => (typeof s?.name === 'string' ? s.name.trim() : ''))
    .filter(Boolean)
    .join(' | ');
}

function mapProfileToView(
  profile: ProfileApiResponse | null,
  occupationRecord: Record<string, unknown> | null
): ProfileViewData {
  if (!profile) {
    return {
      name: '',
      jobTitle: '',
      department: '',
      organization: '',
      groups: [],
      email: '',
      admissionDate: '',
      birthday: '',
      phone: '',
      bio: '',
      avatarUrl: null,
    };
  }

  const organizationNames =
    profile.organizational_structures
      ?.map((s) => s?.name)
      .filter(Boolean)
      .join(' | ') ?? '';

  const accessName =
    typeof profile.access_level === 'object' && profile.access_level?.name
      ? profile.access_level.name
      : '';

  const occDept = departmentFromOccupation(occupationRecord);
  const occTitle = titleFromOccupation(occupationRecord);

  let departmentFromProfile = '';
  if (typeof profile.department === 'string') {
    departmentFromProfile = profile.department.trim();
  } else if (
    profile.department &&
    typeof profile.department === 'object' &&
    typeof profile.department.name === 'string'
  ) {
    departmentFromProfile = profile.department.name.trim();
  } else if (typeof profile.department_name === 'string') {
    departmentFromProfile = profile.department_name.trim();
  }

  const raw = profile as unknown as Record<string, unknown>;
  if (!departmentFromProfile && typeof raw.departamento === 'string') {
    departmentFromProfile = raw.departamento.trim();
  }

  const departmentProfileSanitized =
    departmentFromProfile &&
    organizationNames &&
    departmentFromProfile.trim() === organizationNames.trim()
      ? ''
      : departmentFromProfile;

  const department =
    departmentProfileSanitized ||
    occDept ||
    departmentFromTypedStructures(profile.organizational_structures);

  const jobTitle =
    occTitle ||
    (typeof profile.job_title === 'string' && profile.job_title.trim()) ||
    (typeof profile.jobTitle === 'string' && profile.jobTitle.trim()) ||
    (typeof profile.position === 'string' && profile.position.trim()) ||
    (typeof profile.occupation === 'string' && profile.occupation.trim()) ||
    (typeof profile.role_name === 'string' && profile.role_name.trim()) ||
    (accessName ? String(accessName).trim() : '');

  return {
    name: profile.name ?? '',
    jobTitle,
    department,
    organization: organizationNames,
    groups: mapStructuresToGroups(profile.organizational_structures, MEDIA_BASE_URL),
    email: profile.email ?? '',
    admissionDate: formatDate(profile.hire_date),
    birthday: formatBirthday(profile.birthday),
    phone: profile.phone ?? '',
    bio: profile.description ?? '',
    avatarUrl: normalizeAvatarUrl(profile, MEDIA_BASE_URL),
  };
}

function initialsForPersonName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const w = parts[0];
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w[0].toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ProfileHeader({
  name,
  avatarUrl,
  imageAuth,
  onBack,
  onMenuPress,
}: {
  name: string;
  avatarUrl: string | null;
  imageAuth: ImageAuth | null;
  onBack: () => void;
  onMenuPress: () => void;
}) {
  const initials = initialsForPersonName(name || 'Colaborador');
  const source =
    avatarUrl != null
      ? buildAuthenticatedImageSource(avatarUrl, imageAuth)
      : null;

  return (
    <View style={styles.headerContainer}>
      <View style={styles.gradientHeader}>
        <View style={styles.headerNav}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleSpacer} />
          <Pressable
            style={styles.backButton}
            onPress={onMenuPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Menu da conta"
          >
            <MaterialIcons name="more-vert" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.avatarContainer}>
        <View style={styles.avatarPlaceholder}>
          {source ? (
            <Image
              source={source}
              style={styles.avatarImage as StyleProp<ImageStyle>}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <View style={styles.infoField}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AboutTab({
  profile,
  loading,
  error,
}: {
  profile: ProfileViewData;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0EA5E9" />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Não foi possível carregar o perfil</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <InfoField
        label="Estrutura Organizacional"
        value={profile.organization}
      />
      <InfoField label="E-mail" value={profile.email} />

      <View style={styles.infoRow}>
        <View style={styles.infoHalf}>
          <Text style={styles.infoLabel}>Data de Admissão</Text>
          <Text style={styles.infoValue}>
            {profile.admissionDate || '—'}
          </Text>
        </View>
        <View style={styles.infoHalf}>
          <Text style={styles.infoLabel}>Data de Aniversário</Text>
          <Text style={styles.infoValue}>{profile.birthday || '—'}</Text>
        </View>
      </View>

      <InfoField label="Telefone" value={profile.phone} />

      <View style={styles.aboutSection}>
        <Text style={styles.sectionTitle}>Sobre mim</Text>
        <Text style={styles.bioText}>
          {profile.bio ||
            'Adicione uma descrição ao seu perfil para que sua equipe conheça mais sobre você.'}
        </Text>
      </View>

      <View style={styles.eventsSection}>
        <Text style={styles.sectionTitle}>Evento do colaborador na empresa</Text>
        <Text style={styles.eventsPlaceholder}>
          Em breve você verá aqui os eventos relacionados ao seu percurso na
          empresa.
        </Text>
      </View>
    </View>
  );
}

const TESTIMONIAL_PREVIEW_LINES = 4;

function TestimonialCardItem({
  t,
  profileDisplayName,
}: {
  t: TestimonialApiResponse;
  profileDisplayName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const authorName =
    (t.from && typeof t.from === 'object' && t.from?.name) || 'Colaborador';
  const message =
    (t.message && t.message.trim()) ||
    (t.text && t.text.trim()) ||
    (t.content && t.content.trim()) ||
    '';
  const needsReadMore = message.length > 140;

  return (
    <View style={styles.testimonialCard}>
      <View style={styles.testimonialBadge}>
        <MaterialIcons name="favorite" size={14} color="#DB2777" />
        <Text style={styles.testimonialBadgeText}>Depoimento</Text>
      </View>
      <Text style={styles.testimonialCardTitle}>
        {profileDisplayName} ganhou um novo depoimento de:
      </Text>
      <View style={styles.testimonialAuthorRow}>
        <View style={styles.testimonialAvatar}>
          <Text style={styles.testimonialAvatarText}>
            {authorName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.testimonialAuthor}>{authorName}</Text>
      </View>
      {message ? (
        <Text
          style={styles.testimonialMessage}
          numberOfLines={expanded ? undefined : TESTIMONIAL_PREVIEW_LINES}
        >
          {message}
        </Text>
      ) : null}
      {message && (needsReadMore || expanded) ? (
        <Pressable
          style={styles.readMoreButton}
          onPress={() => setExpanded((e) => !e)}
        >
          <Text style={styles.readMoreText}>
            {expanded ? 'Mostrar menos' : 'Leia mais'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TestimonialsTab({
  testimonials,
  loading,
  error,
  onRetry,
  profileDisplayName,
}: {
  testimonials: TestimonialApiResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  profileDisplayName: string;
}) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0EA5E9" />
        <Text style={styles.loadingText}>Carregando depoimentos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Não foi possível carregar os depoimentos</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  if (!testimonials || testimonials.length === 0) {
    return (
      <View style={styles.tabContent}>
        <View style={styles.emptyState}>
          <MaterialIcons name="rate-review" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateText}>Nenhum depoimento ainda</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {testimonials.map((t) => (
        <TestimonialCardItem
          key={t.id}
          t={t}
          profileDisplayName={profileDisplayName}
        />
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTabId>('about');
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileApiData, setProfileApiData] = useState<ProfileApiResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testimonials, setTestimonials] = useState<TestimonialApiResponse[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [testimonialsError, setTestimonialsError] = useState<string | null>(null);
  const [occupationRecord, setOccupationRecord] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [imageAuth, setImageAuth] = useState<ImageAuth | null>(null);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const viewData = useMemo(
    () => mapProfileToView(profileApiData, occupationRecord),
    [profileApiData, occupationRecord]
  );

  const aboutTabLabel = useMemo(() => {
    const first = firstNameFromFullName(viewData.name);
    return first ? `Tudo sobre ${first}` : 'Tudo sobre mim';
  }, [viewData.name]);

  const profileDisplayName = viewData.name.trim() || 'Colaborador';

  const { setProfileName } = useProfileName();
  useEffect(() => {
    const name = viewData.name?.trim();
    if (name) setProfileName(name);
  }, [viewData.name, setProfileName]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTestimonialsError(null);
    setOccupationRecord(null);
    try {
      const context = await getStoredAuthContext();
      if (!context?.token) {
        setError('Sessão inválida. Faça login novamente para ver o perfil.');
        setProfileApiData(null);
        setImageAuth(null);
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${context.token}`,
      };

      const tenantId = context.tenantId || DEFAULT_TENANT_ID;
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      }

      if (context.collabId) {
        headers['x-collab-id'] = context.collabId;
      }

      if (context.userId) {
        headers['x-user-id'] = context.userId;
      }

      let collabIdForTestimonials: string | null = context.collabId ?? null;
      let resolvedTenantId = context.tenantId || DEFAULT_TENANT_ID;
      let resolvedUserId = context.userId ?? null;

      if (!collabIdForTestimonials || !resolvedTenantId) {
        if (auth.currentUser) {
          const refreshed = await refreshAuthContextWithFirebase();
          if (refreshed) {
            collabIdForTestimonials = refreshed.collabId ?? collabIdForTestimonials;
            resolvedTenantId = refreshed.tenantId || DEFAULT_TENANT_ID || resolvedTenantId;
            if (resolvedTenantId) headers['x-tenant-id'] = resolvedTenantId;
            if (refreshed.collabId) headers['x-collab-id'] = refreshed.collabId;
            if (refreshed.userId) headers['x-user-id'] = refreshed.userId;
            if (refreshed.userId) resolvedUserId = refreshed.userId;
          }
        }
      }

      setImageAuth({
        token: context.token,
        tenantId: resolvedTenantId ?? null,
        collabId: collabIdForTestimonials ?? null,
        userId: resolvedUserId,
      });

      let endpoint: string;
      if (collabIdForTestimonials) {
        endpoint = `${CORE_API_BASE}/collabs/${encodeURIComponent(
          collabIdForTestimonials
        )}`;
      } else if (auth.currentUser && resolvedTenantId) {
        endpoint = `${CORE_API_BASE}/collabs/auth/${encodeURIComponent(
          auth.currentUser.uid
        )}`;
      } else {
        setError(
          resolvedTenantId
            ? 'Sessão incompleta. Faça login novamente para acessar o perfil.'
            : 'Tenant não configurado. Configure DEFAULT_TENANT_ID ou faça login novamente.'
        );
        setProfileApiData(null);
        setImageAuth(null);
        return;
      }

      let response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });

      if (response.status === 404 && !context.collabId && auth.currentUser && resolvedTenantId) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          const syncRes = await fetch(
            `${CORE_API_BASE}/collabs/sync-firebase-user`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${context.token}`,
                'Content-Type': 'application/json',
                'x-tenant-id': resolvedTenantId,
              },
              body: JSON.stringify({ idToken }),
            }
          );
          if (syncRes.ok) {
            response = await fetch(endpoint, { method: 'GET', headers });
          }
        } catch {
          /* ignore */
        }
      }

      if (!response.ok) {
        const raw = await response.text();
        let parsed: unknown = {};
        try {
          parsed = raw.length > 0 ? (JSON.parse(raw) as unknown) : {};
        } catch {
          parsed = {};
        }

        let message = '';
        if (parsed && typeof parsed === 'object') {
          const obj = parsed as Record<string, unknown>;
          if (typeof obj.message === 'string') {
            message = obj.message;
          }
        }

        setError(message || 'Erro ao carregar dados do perfil.');
        setProfileApiData(null);
        setImageAuth(null);
        return;
      }

      const data = (await response.json()) as ProfileApiResponse & {
        tenantId?: string;
        tenant_id?: string;
        tenant?: { id?: string; tenantId?: string; tenant_id?: string };
      };
      setProfileApiData(data);

      const collabForOccupation = data.id ?? collabIdForTestimonials;
      if (collabForOccupation) {
        try {
          const occRes = await fetch(
            `${CORE_API_BASE}/collabs/${encodeURIComponent(
              collabForOccupation
            )}/occupations/current`,
            { method: 'GET', headers }
          );
          if (occRes.ok) {
            const occJson: unknown = await occRes.json();
            let occ: Record<string, unknown> | null = null;
            if (Array.isArray(occJson) && occJson[0] && typeof occJson[0] === 'object') {
              occ = occJson[0] as Record<string, unknown>;
            } else if (occJson && typeof occJson === 'object') {
              const o = occJson as Record<string, unknown>;
              occ =
                o.data && typeof o.data === 'object'
                  ? (o.data as Record<string, unknown>)
                  : o;
            }
            setOccupationRecord(occ);
          }
        } catch {
          /* optional enrichment */
        }
      }

      const possibleTenantId =
        (typeof data.tenantId === 'string' && data.tenantId) ||
        (typeof data.tenant_id === 'string' && data.tenant_id) ||
        (data.tenant &&
          typeof data.tenant === 'object' &&
          ((data.tenant.id &&
            typeof data.tenant.id === 'string' &&
            data.tenant.id) ||
            (data.tenant.tenantId &&
              typeof data.tenant.tenantId === 'string' &&
              data.tenant.tenantId) ||
            (data.tenant.tenant_id &&
              typeof data.tenant.tenant_id === 'string' &&
              data.tenant.tenant_id))) ||
        null;

      if (possibleTenantId) {
        await AsyncStorage.setItem(AUTH_TENANT_ID_KEY, possibleTenantId);
      }
      if (!collabIdForTestimonials) {
        collabIdForTestimonials = data.id ?? null;
      }
      setImageAuth({
        token: context.token,
        tenantId: possibleTenantId ?? resolvedTenantId ?? null,
        collabId: collabIdForTestimonials ?? null,
        userId: resolvedUserId,
      });

      if (collabIdForTestimonials) {
        setTestimonialsLoading(true);
        try {
          const testimonialsResponse = await fetch(
            `${CORE_API_BASE}/collabs/${encodeURIComponent(
              collabIdForTestimonials
            )}/testimonials/received`,
            {
              method: 'GET',
              headers,
            }
          );

          if (testimonialsResponse.ok) {
            const testimonialsData =
              (await testimonialsResponse.json()) as TestimonialApiResponse[];
            setTestimonials(
              Array.isArray(testimonialsData) ? testimonialsData : []
            );
          } else {
            setTestimonials([]);
          }

          
        } catch (e) {
          const err = e as Error;
          setTestimonialsError(
            err.message || 'Erro inesperado ao carregar os depoimentos.'
          );
          setTestimonials([]);
        } finally {
          setTestimonialsLoading(false);
        }
      } else {
        setTestimonials([]);
      }
    } catch (e) {
      const err = e as Error;
      setError(err.message || 'Erro inesperado ao carregar o perfil.');
      setProfileApiData(null);
      setOccupationRecord(null);
      setImageAuth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ProfileHeader
          name={viewData.name || 'Colaborador'}
          avatarUrl={viewData.avatarUrl}
          imageAuth={imageAuth}
          onBack={handleBack}
          onMenuPress={openMenu}
        />

        <View style={styles.nameSection}>
          <Text style={styles.profileName}>
            {viewData.name || 'Colaborador'}
          </Text>
          {viewData.jobTitle ? (
            <Text style={styles.profileRole}>{viewData.jobTitle}</Text>
          ) : null}
        </View>

        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'about' && styles.tabTextActive,
              ]}
            >
              {aboutTabLabel}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'testimonials' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('testimonials')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'testimonials' && styles.tabTextActive,
              ]}
            >
              Depoimentos
            </Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {activeTab === 'about' ? (
          <AboutTab profile={viewData} loading={loading} error={error} />
        ) : (
          <TestimonialsTab
            testimonials={testimonials}
            loading={testimonialsLoading}
            error={testimonialsError}
            onRetry={loadProfile}
            profileDisplayName={profileDisplayName}
          />
        )}
      </ScrollView>
      <AccountDropdownMenu visible={menuOpen} onClose={closeMenu} />
      <SideDrawer visible={drawerOpen} onClose={closeDrawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    position: 'relative',
    marginBottom: PROFILE_AVATAR_SIZE / 2,
  },
  gradientHeader: {
    height: HEADER_HEIGHT,
    paddingTop: 16,
    backgroundColor: HEADER_PINK,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerTitleSpacer: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -(PROFILE_AVATAR_SIZE / 2),
    left: 24,
  },
  avatarPlaceholder: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    backgroundColor: '#E5E7EB',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: PROFILE_AVATAR_SIZE - 8,
    height: PROFILE_AVATAR_SIZE - 8,
    borderRadius: (PROFILE_AVATAR_SIZE - 8) / 2,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#6B7280',
  },

  nameSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  profileRole: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 24,
  },
  tab: {
    paddingBottom: 10,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: TAB_TEAL,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: TAB_TEAL,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  tabContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B91C1C',
  },
  errorText: {
    fontSize: 14,
    color: '#4B5563',
  },

  infoField: {
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoHalf: {
    flex: 1,
  },

  eventsPlaceholder: {
    fontSize: 14,
    lineHeight: 22,
    color: '#9CA3AF',
    marginTop: 4,
  },
  aboutSection: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },

  eventsSection: {
    marginTop: 32,
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 100,
  },
  timelineIndicator: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineDotCurrent: {
    backgroundColor: '#0EA5E9',
  },
  timelineDotPast: {
    backgroundColor: '#D1D5DB',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
  },

  eventCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  eventCardCurrent: {
    backgroundColor: '#E0F2FE',
  },
  eventCardPast: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBadgeCurrent: {
    backgroundColor: '#FEF3C7',
  },
  eventBadgePast: {
    backgroundColor: '#F3E8FF',
  },
  eventInfo: {
    marginLeft: 12,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  eventTitleCurrent: {
    color: '#0C4A6E',
  },
  eventDepartment: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  eventDepartmentCurrent: {
    color: '#0369A1',
  },
  eventPeriod: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
    marginLeft: 56,
  },
  eventPeriodCurrent: {
    color: '#0284C7',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  retryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0EA5E9',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testimonialCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  testimonialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
    marginBottom: 12,
  },
  testimonialBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BE185D',
  },
  testimonialCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    lineHeight: 22,
  },
  testimonialAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  testimonialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  testimonialAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  testimonialAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  testimonialMessage: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
  readMoreButton: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
});
