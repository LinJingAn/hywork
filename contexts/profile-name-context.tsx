import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { CORE_API_BASE, DEFAULT_TENANT_ID, MEDIA_BASE_URL } from '@/config/auth';
import { auth } from '@/config/firebase';
import { getStoredAuthContext, refreshAuthContextWithFirebase } from '@/services/auth';
import type { ImageAuth, ProfileApiResponse } from '@/utils/profile-avatar';
import { normalizeAvatarUrl } from '@/utils/profile-avatar';

interface ProfileNameContextValue {
  profileName: string;
  profileAvatarUrl: string | null;
  profileImageAuth: ImageAuth | null;
  setProfileName: (name: string) => void;
  refreshProfileName: () => Promise<void>;
}

const ProfileNameContext = createContext<ProfileNameContextValue | null>(null);

export function useProfileName() {
  const ctx = useContext(ProfileNameContext);
  return (
    ctx ?? {
      profileName: '',
      profileAvatarUrl: null,
      profileImageAuth: null,
      setProfileName: () => {},
      refreshProfileName: async () => {},
    }
  );
}

async function fetchProfileSummary(): Promise<{
  name: string;
  avatarUrl: string | null;
  imageAuth: ImageAuth | null;
}> {
  const empty = { name: '', avatarUrl: null as string | null, imageAuth: null as ImageAuth | null };
  try {
    const context = await getStoredAuthContext();
    if (!context?.token) return empty;
    let tenantId = context.tenantId ?? DEFAULT_TENANT_ID;
    let collabId = context.collabId ?? null;
    if (!tenantId || !collabId) {
      const refreshed = await refreshAuthContextWithFirebase();
      tenantId = refreshed?.tenantId ?? tenantId ?? DEFAULT_TENANT_ID ?? null;
      collabId = refreshed?.collabId ?? collabId ?? null;
    }
    if (!tenantId) return empty;
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
      return empty;
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
    if (!res.ok) return empty;
    const data = (await res.json()) as ProfileApiResponse;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const avatarUrl = normalizeAvatarUrl(data, MEDIA_BASE_URL);
    const imageAuth: ImageAuth = {
      token: context.token,
      tenantId,
      collabId,
      userId: context.userId ?? null,
    };
    return { name, avatarUrl, imageAuth };
  } catch {
    return empty;
  }
}

export function ProfileNameProvider({ children }: { children: React.ReactNode }) {
  const [profileName, setProfileName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileImageAuth, setProfileImageAuth] = useState<ImageAuth | null>(null);

  const loadProfileName = useCallback(async () => {
    const { name, avatarUrl, imageAuth } = await fetchProfileSummary();
    if (name) setProfileName(name);
    setProfileAvatarUrl(avatarUrl);
    setProfileImageAuth(imageAuth);
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
        setProfileAvatarUrl(null);
        setProfileImageAuth(null);
      }
    });
    if (auth.currentUser) {
      loadProfileName();
    }
    return () => unsubscribe();
  }, [loadProfileName]);

  return (
    <ProfileNameContext.Provider
      value={{
        profileName,
        profileAvatarUrl,
        profileImageAuth,
        setProfileName,
        refreshProfileName,
      }}
    >
      {children}
    </ProfileNameContext.Provider>
  );
}
