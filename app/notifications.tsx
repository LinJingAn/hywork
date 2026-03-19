import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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

type NotificationType = 'announcement' | 'comment' | 'birthday' | 'post';

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

function NotificationRow({ item }: { item: NotificationItem }) {
  return (
    <View style={styles.notifCard}>
      <View style={styles.notifRow}>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <View style={[styles.notifAvatar, { backgroundColor: item.authorColor }]}>
              <Text style={styles.notifAvatarText}>
                {item.authorName?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.notifTitleBlock}>
              <Text style={styles.notifAuthor}>{item.authorName}</Text>
              <Text style={styles.notifSubtitle}>
                {item.subtitle}
                <Text style={styles.notifSubtitleBold}>{item.subtitleBold}</Text>
                {item.birthdayCount != null && (
                  <Text style={styles.notifSubtitleBold}>
                    {' '}e de outras {item.birthdayCount} pessoas
                  </Text>
                )}
              </Text>
            </View>
          </View>

          {item.card && (
            <View style={styles.card}>
              <View style={styles.cardImagePlaceholder} />
              <View style={styles.cardOverlay}>
                <Text style={styles.cardTitle}>{item.card.title}</Text>
                <Text style={styles.cardDate}>{item.card.date}</Text>
                <Text style={styles.cardQuote}>{item.card.quote}</Text>
              </View>
            </View>
          )}

          {item.type === 'birthday' && item.avatarColors && (
            <View style={styles.birthdayAvatars}>
              {item.avatarColors.map((color, i) => (
                <View
                  key={i}
                  style={[styles.birthdayAvatar, { backgroundColor: color }]}
                >
                  <Text style={styles.birthdayAvatarText}>
                    {['A', 'B', 'C', 'D'][i]}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {item.message ? (
            <View style={styles.messageContainer}>
              <Text style={styles.notifMessage} numberOfLines={2}>
                {item.message}
              </Text>
            </View>
          ) : null}

          {item.timeAgo ? (
            <Text style={styles.notifTime}>{item.timeAgo}</Text>
          ) : null}
        </View>
      </View>
    </View>
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

  async function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, unread: false }))
    );
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
      await fetch(`${CORE_API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers,
      });
      refreshUnreadCount();
    } catch {
      if (__DEV__) console.warn('[Notifications] Failed to mark all as read on backend');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              try {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/success');
                }
              } catch {
                router.replace('/success');
              }
            }}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1E293B" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notificação</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.backButton} />
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
          {notifications.map((item) => (
            <NotificationRow key={item.id} item={item} />
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
  if (!context?.token) {
    return [];
  }

  const tenantId = context.tenantId || DEFAULT_TENANT_ID;
  if (!tenantId) {
    return [];
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.token}`,
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };
  if (context.collabId) headers['x-collab-id'] = context.collabId;

  let res: Response;
  try {
    res = await fetch(`${CORE_API_BASE}/notifications?page=1&limit=20`, { headers });
  } catch {
    throw new Error('Verifique sua conexão e tente novamente.');
  }

  if (!res.ok) {
    if (res.status === 404) return [];
    const hasBody = res.headers.get('content-type')?.includes('json');
    const body = hasBody ? await res.json().catch(() => ({})) : {};
    const message = body?.message ?? body?.error ?? null;
    throw new Error(
      typeof message === 'string' ? message : 'Falha ao carregar notificações.'
    );
  }

  const data = await res.json();
  return normalizeNotifications(data);
}

function normalizeNotifications(data: unknown): NotificationItem[] {
  if (!Array.isArray(data)) return [];

  const items: NotificationItem[] = [];
  const avatarColors = ['#5B9BD5', '#E06C75', '#D4A373', '#7FB685', '#A855F7'];

  for (let i = 0; i < data.length; i++) {
    const raw = data[i] as Record<string, unknown>;
    const id = String(raw.id ?? raw._id ?? i);
    const authorName = String(raw.authorName ?? raw.author_name ?? raw.from?.name ?? '');
    const colorIndex = i % avatarColors.length;

    items.push({
      id,
      type: (raw.type as NotificationType) ?? 'post',
      unread: Boolean(raw.unread ?? raw.read === false),
      authorName: authorName || '—',
      authorColor: (raw.authorColor as string) ?? avatarColors[colorIndex],
      subtitle: String(raw.subtitle ?? ''),
      subtitleBold: raw.subtitleBold ? String(raw.subtitleBold) : undefined,
      card: raw.card && typeof raw.card === 'object'
        ? {
            title: String((raw.card as Record<string, unknown>).title ?? ''),
            date: String((raw.card as Record<string, unknown>).date ?? ''),
            quote: String((raw.card as Record<string, unknown>).quote ?? ''),
          }
        : undefined,
      message: raw.message ? String(raw.message) : undefined,
      timeAgo: String(raw.timeAgo ?? raw.createdAt ?? ''),
      birthdayNames: raw.birthdayNames ? String(raw.birthdayNames) : undefined,
      birthdayCount: typeof raw.birthdayCount === 'number' ? raw.birthdayCount : undefined,
      avatarColors: Array.isArray(raw.avatarColors)
        ? (raw.avatarColors as string[])
        : avatarColors,
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  badge: {
    backgroundColor: '#94A3B8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  notifRow: {
    flexDirection: 'row',
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  notifTitleBlock: {
    flex: 1,
    marginLeft: 12,
  },
  notifAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  notifSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  notifSubtitleBold: {
    fontWeight: '700',
    color: '#64748B',
  },
  messageContainer: {
    marginTop: 16,
    marginLeft: 52,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F97316',
  },
  notifMessage: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    marginLeft: 52,
  },

  card: {
    marginTop: 12,
    marginLeft: 52,
    borderRadius: 12,
    overflow: 'hidden',
    height: 100,
    backgroundColor: '#1E293B',
  },
  cardImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#334155',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  cardQuote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  birthdayAvatars: {
    flexDirection: 'row',
    marginTop: 10,
    marginLeft: 52,
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
