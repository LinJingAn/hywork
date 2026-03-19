import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { CORE_API_BASE, DEFAULT_TENANT_ID } from '@/config/auth';
import { getStoredAuthContext, refreshAuthContextWithFirebase } from '@/services/auth';

interface NotificationsContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  return ctx ?? { unreadCount: 0, refreshUnreadCount: async () => {} };
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const context = await getStoredAuthContext();
      if (!context?.token) {
        setUnreadCount(0);
        return;
      }
      let tenantId = context.tenantId ?? DEFAULT_TENANT_ID;
      if (!tenantId) {
        const refreshed = await refreshAuthContextWithFirebase();
        tenantId = refreshed?.tenantId ?? DEFAULT_TENANT_ID ?? null;
      }
      if (!tenantId) {
        setUnreadCount(0);
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${context.token}`,
        'x-tenant-id': tenantId,
      };
      if (context.collabId) headers['x-collab-id'] = context.collabId;
      const res = await fetch(`${CORE_API_BASE}/notifications`, { headers });
      if (!res.ok) {
        if (res.status === 404) setUnreadCount(0);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const count = list.filter(
        (n: { unread?: boolean; read?: boolean }) =>
          n.unread === true || n.read === false
      ).length;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}
