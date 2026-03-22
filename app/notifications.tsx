import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNotifications } from '@/contexts/notifications-context';

type NotificationType = 'news' | 'announcement' | 'comment' | 'birthday' | 'post';

interface NotificationItem {
  id: string;
  type: NotificationType;
  unread: boolean;
  authorName: string;
  authorColor: string;
  subtitle: string;
  subtitleBold?: string;
  card?: { title: string; date: string; quote: string };
  message?: string;
  timeAgo: string;
  birthdayNames?: string;
  birthdayCount?: number;
  avatarColors?: string[];
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `há cerca de ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays === 1) return 'há 1 dia';
    return `há ${diffDays} dias`;
  } catch {
    return dateStr;
  }
}

async function markNotificationRead(notificationId: string): Promise<void> {
  const { getStoredAuthContext } = await import('@/services/auth');
  const { CORE_API_BASE, DEFAULT_TENANT_ID } = await import('@/config/auth');

  const context = await getStoredAuthContext();
  if (!context?.token) return;

  const tenantId = context.tenantId || DEFAULT_TENANT_ID;
  const collabId = context.collabId || null;
  if (!tenantId || !collabId) return;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
    'x-collab-id': collabId,
  };

  try {
    await fetch(`${CORE_API_BASE}/notifications/open`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notification_id: notificationId }),
    });
  } catch {
    if (__DEV__) console.warn('[Notifications] Failed to mark notification as read:', notificationId);
  }
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.notifCard,
        pressed && styles.notifCardPressed,
      ]}
      onPress={() => onPress(item.id)}
    >
      <View style={styles.notifRow}>
        <View style={styles.checkmarkWrap}>
          {item.unread ? (
            <View style={styles.unreadDot} />
          ) : (
            <MaterialIcons name="check" size={18} color="#94A3B8" />
          )}
        </View>

        <View style={styles.notifContent}>
          <Text style={[styles.notifAuthor, item.unread && styles.notifAuthorUnread]}>
            {item.authorName}
          </Text>
          <Text style={styles.notifSubtitle} numberOfLines={2}>
            {item.subtitle}
            {item.subtitleBold ? (
              <Text style={styles.notifSubtitleBold}>{item.subtitleBold}</Text>
            ) : null}
            {item.birthdayCount != null && (
              <Text style={styles.notifSubtitleBold}>
                {' '}e de outras {item.birthdayCount} pessoas
              </Text>
            )}
          </Text>

          {item.type === 'birthday' && item.avatarColors && (
            <View style={styles.birthdayAvatars}>
              {item.avatarColors.map((color, i) => (
                <View key={i} style={[styles.birthdayAvatar, { backgroundColor: color }]}>
                  <Text style={styles.birthdayAvatarText}>{['A', 'B', 'C', 'D'][i]}</Text>
                </View>
              ))}
            </View>
          )}

          {item.timeAgo ? (
            <Text style={styles.notifTime}>{formatRelativeTime(item.timeAgo)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshUnreadCount } = useNotifications();

  const unreadCount = notifications.filter((n) => n.unread).length;

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchNotifications();
      setNotifications(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar notificações.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (id: string) => {
      const item = notifications.find((n) => n.id === id);
      if (!item) return;
      if (item.unread) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
        );
        await markNotificationRead(id);
        refreshUnreadCount();
      }
    },
    [notifications, refreshUnreadCount]
  );

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      const { getStoredAuthContext } = await import('@/services/auth');
      const { CORE_API_BASE, DEFAULT_TENANT_ID } = await import('@/config/auth');
      const context = await getStoredAuthContext();
      if (!context?.token) return;
      const tenantId = context.tenantId || DEFAULT_TENANT_ID;
      if (!tenantId) return;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${context.token}`,
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      };
      if (context.collabId) headers['x-collab-id'] = context.collabId;
      await fetch(`${CORE_API_BASE}/notifications/read-all`, { method: 'PUT', headers });
      refreshUnreadCount();
    } catch {
      if (__DEV__) console.warn('[Notifications] Failed to mark all as read on backend');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>

          {/* Back button — left */}
          <Pressable
            style={styles.backButton}
            onPress={() => {
              try {
                if (router.canGoBack()) router.back();
                else router.replace('/success');
              } catch {
                router.replace('/success');
              }
            }}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1E293B" />
          </Pressable>

          {/* Title — center */}
          <Text style={styles.headerTitle}>Notificação</Text>

          {/* ✅ Unread count badge — top right */}
          <View style={styles.badgeWrap}>
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : (
              // Keep space so title stays centered when no badge
              <View style={styles.badgePlaceholder} />
            )}
          </View>

        </View>

        {unreadCount > 0 && (
          <Pressable style={styles.markReadWrap} hitSlop={8} onPress={handleMarkAllRead}>
            <Text style={styles.markReadText}>Marcar todas como lido</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadNotifications}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="notifications-none" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptySubtitle}>
            Você receberá notificações de comentários, aniversários e posts aqui.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((item, index) => (
            <View key={item.id}>
              <NotificationRow item={item} onPress={handleNotificationPress} />
              {index < notifications.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  const { getStoredAuthContext } = await import('@/services/auth');
  const { CORE_API_BASE, DEFAULT_TENANT_ID } = await import('@/config/auth');

  const context = await getStoredAuthContext();
  if (!context?.token) return [];

  const tenantId = context.tenantId || DEFAULT_TENANT_ID;
  const collabId = context.collabId || null;
  if (!tenantId || !collabId) return [];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
    'x-collab-id': collabId,
  };

  let res: Response;
  try {
    res = await fetch(`${CORE_API_BASE}/notifications?page=1&limit=20`, {
      method: 'GET',
      headers,
    });
  } catch {
    throw new Error('Verifique sua conexão e tente novamente.');
  }

  if (!res.ok) {
    if (res.status === 404) return [];
    const hasBody = res.headers.get('content-type')?.includes('json');
    const body = hasBody ? await res.json().catch(() => ({})) : {};
    const message = body?.message ?? body?.error ?? null;
    throw new Error(typeof message === 'string' ? message : 'Falha ao carregar notificações.');
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.notifications ?? []);
  return normalizeNotifications(list);
}

function normalizeNotifications(data: unknown): NotificationItem[] {
  if (!Array.isArray(data)) return [];

  const avatarColors = ['#5B9BD5', '#E06C75', '#D4A373', '#7FB685', '#A855F7'];
  const items: NotificationItem[] = [];

  for (let i = 0; i < data.length; i++) {
    const raw = data[i] as Record<string, unknown>;
    const id = String(raw.id ?? raw._id ?? i);
    const colorIndex = i % avatarColors.length;

    const title = String(raw.title ?? '');
    const body = String(raw.body ?? raw.message ?? '');
    const isRead = Boolean(raw.is_read ?? raw.read ?? false);
    const createdAt = String(raw.createdAt ?? raw.sent_at ?? '');
    const type = String(raw.type ?? 'post').toLowerCase() as NotificationType;

    items.push({
      id,
      type: type === 'news' ? 'announcement' : (type as NotificationType),
      unread: !isRead,
      authorName: title || '—',
      authorColor: avatarColors[colorIndex],
      subtitle: body,
      subtitleBold: undefined,
      message: undefined,
      timeAgo: createdAt,
      card: undefined,
      birthdayNames: undefined,
      birthdayCount: undefined,
      avatarColors: undefined,
    });
  }

  return items;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    // ✅ Centered between back button and badge
    flex: 1,
    textAlign: 'center',
  },

  // ✅ Right-side badge container — same width as backButton to keep title centered
  badgeWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Keeps layout balanced when badge is hidden
  badgePlaceholder: {
    width: 24,
    height: 24,
  },

  markReadWrap: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  markReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F97316',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  notifCardPressed: {
    backgroundColor: '#F8FAFC',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 20,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkmarkWrap: {
    width: 24,
    marginTop: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F97316',
  },
  notifContent: {
    flex: 1,
  },
  notifAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  notifAuthorUnread: {
    color: '#0F172A',
  },
  notifSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 20,
  },
  notifSubtitleBold: {
    fontWeight: '700',
    color: '#64748B',
  },
  notifTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  birthdayAvatars: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  birthdayAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayAvatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F97316',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
