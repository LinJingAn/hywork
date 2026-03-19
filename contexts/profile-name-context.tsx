import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { CORE_API_BASE, DEFAULT_TENANT_ID } from '@/config/auth';
import { auth } from '@/config/firebase';
import { getStoredAuthContext, refreshAuthContextWithFirebase } from '@/services/auth';

interface ProfileNameContextValue {
  profileName: string;
  setProfileName: (name: string) => void;
  refreshProfileName: () => Promise<void>;
}

const ProfileNameContext = createContext<ProfileNameContextValue | null>(null);

export function useProfileName() {
  const ctx = useContext(ProfileNameContext);
  return (
    ctx ?? {
      profileName: '',
      setProfileName: () => {},
      refreshProfileName: async () => {},
    }
  );
}

async function fetchProfileName(): Promise<string> {
  try {
    const context = await getStoredAuthContext();
    if (!context?.token) return '';
    let tenantId = context.tenantId ?? DEFAULT_TENANT_ID;
    let collabId = context.collabId ?? null;
    if (!tenantId || !collabId) {
      const refreshed = await refreshAuthContextWithFirebase();
      tenantId = refreshed?.tenantId ?? tenantId ?? DEFAULT_TENANT_ID ?? null;
      collabId = refreshed?.collabId ?? collabId ?? null;
    }
    if (!tenantId) return '';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${context.token}`,
      'x-tenant-id': tenantId,
    };
    if (collabId) headers['x-collab-id'] = collabId;
    if (context.userId) headers['x-user-id'] = context.userId;
    let endpoint: string;
    if (collabId) {
      endpoint = `${CORE_API_BASE}/collabs/${encodeURIComponent(collabId)}`;
    } else if (auth.currentUser && tenantId) {
      endpoint = `${CORE_API_BASE}/collabs/auth/${encodeURIComponent(auth.currentUser.uid)}`;
    } else {
      return '';
    }
    let res = await fetch(endpoint, { method: 'GET', headers });
    if (res.status === 404 && !context.collabId && auth.currentUser && tenantId) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const syncRes = await fetch(`${CORE_API_BASE}/collabs/sync-firebase-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.token}`,
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
          },
          body: JSON.stringify({ idToken }),
        });
        if (syncRes.ok) {
          res = await fetch(endpoint, { method: 'GET', headers });
        }
      } catch {
        /* ignore */
      }
    }
    if (!res.ok) return '';
    const data = (await res.json()) as { name?: string };
    return typeof data.name === 'string' ? data.name.trim() : '';
  } catch {
    return '';
  }
}

export function ProfileNameProvider({ children }: { children: React.ReactNode }) {
  const [profileName, setProfileName] = useState('');

  const loadProfileName = useCallback(async () => {
    const name = await fetchProfileName();
    if (name) setProfileName(name);
  }, []);

  const refreshProfileName = useCallback(async () => {
    await loadProfileName();
  }, [loadProfileName]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadProfileName();
      } else {
        setProfileName('');
      }
    });
    if (auth.currentUser) {
      loadProfileName();
    }
    return () => unsubscribe();
  }, [loadProfileName]);

  return (
    <ProfileNameContext.Provider value={{ profileName, setProfileName, refreshProfileName }}>
      {children}
    </ProfileNameContext.Provider>
  );
}
