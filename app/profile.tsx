import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CORE_API_BASE, DEFAULT_TENANT_ID } from '@/config/auth';
import { auth } from '@/config/firebase';
import { AccountDropdownMenu, GreetingBar } from '@/components/app-header';
import { useProfileName } from '@/contexts/profile-name-context';
import { SideDrawer } from '@/components/side-drawer';
import {
  getStoredAuthContext,
  refreshAuthContextWithFirebase,
} from '@/services/auth';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AUTH_TENANT_ID_KEY = '@hywork/tenant_id';

const TABS = ['Tudo sobre mim', 'Depoimentos'] as const;

const PROFILE_AVATAR_SIZE = 100;
const HEADER_HEIGHT = 180;

interface ProfileApiResponse {
  id: string;
  name: string;
  email: string;
  thumb?: string | null;
  description?: string | null;
  phone?: string | null;
  birthday?: string | null;
  hire_date?: string | null;
  access_level?:
    | {
        name?: string | null;
      }
    | null;
  organizational_structures?:
    | {
        name?: string | null;
      }[]
    | null;
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

interface ProfileViewData {
  name: string;
  role: string;
  organization: string;
  email: string;
  admissionDate: string;
  birthday: string;
  phone: string;
  bio: string;
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatBirthday(isoDate?: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatDateTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
}

function mapProfileToView(profile: ProfileApiResponse | null): ProfileViewData {
  if (!profile) {
    return {
      name: '',
      role: '',
      organization: '',
      email: '',
      admissionDate: '',
      birthday: '',
      phone: '',
      bio: '',
    };
  }

  const organizationNames =
    profile.organizational_structures
      ?.map((s) => s?.name)
      .filter(Boolean)
      .join(' | ') ?? '';

  const role =
    (typeof profile.access_level === 'object' &&
      profile.access_level?.name) ||
    '';

  return {
    name: profile.name ?? '',
    role,
    organization: organizationNames,
    email: profile.email ?? '',
    admissionDate: formatDate(profile.hire_date),
    birthday: formatBirthday(profile.birthday),
    phone: profile.phone ?? '',
    bio: profile.description ?? '',
  };
}

function ProfileHeader() {
  return (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['#F472B6', '#EC4899', '#DB2777']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerNav}>
          <View style={styles.backButton} />
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <View style={styles.avatarContainer}>
        <View style={styles.avatarPlaceholder}>
          <MaterialIcons name="person" size={48} color="#9CA3AF" />
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
          <Text style={styles.infoValue}>{profile.admissionDate}</Text>
        </View>
        <View style={styles.infoHalf}>
          <Text style={styles.infoLabel}>Data de Aniversário</Text>
          <Text style={styles.infoValue}>{profile.birthday}</Text>
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
    </View>
  );
}

function TestimonialsTab({
  testimonials,
  loading,
  error,
  onRetry,
}: {
  testimonials: TestimonialApiResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
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
      {testimonials.map((t) => {
        const authorName =
          (t.from && typeof t.from === 'object' && t.from?.name) || 'Colaborador';
        const rawDate = t.created_at ?? t.createdAt ?? null;
        const formattedDate = formatDateTime(rawDate);
        const message =
          (t.message && t.message.trim()) ||
          (t.text && t.text.trim()) ||
          (t.content && t.content.trim()) ||
          '';

        return (
          <View key={t.id} style={styles.testimonialCard}>
            <View style={styles.testimonialHeader}>
              <View style={styles.testimonialAvatar}>
                <Text style={styles.testimonialAvatarText}>
                  {authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.testimonialHeaderText}>
                <Text style={styles.testimonialAuthor}>{authorName}</Text>
                {formattedDate ? (
                  <Text style={styles.testimonialDate}>{formattedDate}</Text>
                ) : null}
              </View>
            </View>
            {message ? (
              <Text style={styles.testimonialMessage}>{message}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(TABS[0]);
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

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const viewData = useMemo(
    () => mapProfileToView(profileApiData),
    [profileApiData]
  );

  const { setProfileName } = useProfileName();
  useEffect(() => {
    const name = viewData.name?.trim();
    if (name) setProfileName(name);
  }, [viewData.name, setProfileName]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTestimonialsError(null);
    try {
      const context = await getStoredAuthContext();
      if (!context?.token) {
        setError('Sessão inválida. Faça login novamente para ver o perfil.');
        setProfileApiData(null);
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

      if (!collabIdForTestimonials || !resolvedTenantId) {
        if (auth.currentUser) {
          const refreshed = await refreshAuthContextWithFirebase();
          if (refreshed) {
            collabIdForTestimonials = refreshed.collabId ?? collabIdForTestimonials;
            resolvedTenantId = refreshed.tenantId || DEFAULT_TENANT_ID || resolvedTenantId;
            if (resolvedTenantId) headers['x-tenant-id'] = resolvedTenantId;
            if (refreshed.collabId) headers['x-collab-id'] = refreshed.collabId;
            if (refreshed.userId) headers['x-user-id'] = refreshed.userId;
          }
        }
      }

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
        return;
      }

      const data = (await response.json()) as ProfileApiResponse & {
        tenantId?: string;
        tenant_id?: string;
        tenant?: { id?: string; tenantId?: string; tenant_id?: string };
      };
      setProfileApiData(data);

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
      <GreetingBar
        onDotPress={openMenu}
        displayName={viewData.name || undefined}
        showBackButton
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ProfileHeader />

        <View style={styles.nameSection}>
          <Text style={styles.profileName}>
            {viewData.name || 'Colaborador'}
          </Text>
          {viewData.role ? (
            <Text style={styles.profileRole}>{viewData.role}</Text>
          ) : null}
        </View>

        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        {activeTab === TABS[0] ? (
          <AboutTab profile={viewData} loading={loading} error={error} />
        ) : (
          <TestimonialsTab
            testimonials={testimonials}
            loading={testimonialsLoading}
            error={testimonialsError}
            onRetry={loadProfile}
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
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginTop: 2,
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
    borderBottomColor: '#1F2937',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#1F2937',
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
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoHalf: {
    flex: 1,
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
    backgroundColor: '#F9FAFB',
  },
  testimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testimonialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testimonialAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  testimonialHeaderText: {
    marginLeft: 10,
  },
  testimonialAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  testimonialDate: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  testimonialMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
});
