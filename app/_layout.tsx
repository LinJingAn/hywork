import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import type { Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { PushNotificationsInit } from '@/components/push-notifications-init';
import { auth } from '@/config/firebase';
import { NotificationsProvider, useNotifications } from '@/contexts/notifications-context';
import { ProfileNameProvider } from '@/contexts/profile-name-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { suppressNotificationResponseNavigation } from '@/services/notification-open-dedup';
import { getNotificationTapTarget } from '@/services/notification-navigation';

WebBrowser.maybeCompleteAuthSession();

function PushInitWrapper() {
  const { refreshUnreadCount } = useNotifications();
  return <PushNotificationsInit onNotificationReceived={refreshUnreadCount} />;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const launchFromNotificationRef = useRef<Href | null | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && !hasRedirected.current) {
          hasRedirected.current = true;
          router.replace('/success');
        }
      });
      return unsubscribe;
    }

    let cancelled = false;
    launchFromNotificationRef.current = undefined;

    function tryPostAuthNavigate(user: User | null) {
      if (cancelled || hasRedirected.current) return;
      if (launchFromNotificationRef.current === undefined) return;
      if (!user) return;
      hasRedirected.current = true;
      const dest = launchFromNotificationRef.current ?? '/success';
      queueMicrotask(() => {
        router.replace(dest as never);
      });
    }

    const authUnsub = onAuthStateChanged(auth, (user) => {
      tryPostAuthNavigate(user);
    });

    (async () => {
      let response = await Notifications.getLastNotificationResponseAsync();
      if (cancelled) return;
      if (!response && Platform.OS === 'android') {
        await new Promise((r) => setTimeout(r, 500));
        if (cancelled) return;
        response = await Notifications.getLastNotificationResponseAsync();
      }
      if (cancelled) return;

      if (response) {
        suppressNotificationResponseNavigation(4000);
      }

      launchFromNotificationRef.current = response
        ? getNotificationTapTarget(
            response.notification.request.content.data as Record<string, unknown>
          )
        : null;

      tryPostAuthNavigate(auth.currentUser);
    })();

    return () => {
      cancelled = true;
      authUnsub();
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth).then((result) => {
        if (result?.user) {
          router.replace('/success');
        }
      });
    });
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NotificationsProvider>
        <ProfileNameProvider>
        <PushInitWrapper />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="success" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="manage-account" options={{ headerShown: false }} />
        <Stack.Screen name="invite" options={{ headerShown: false }} />
        <Stack.Screen name="institucional" options={{ headerShown: false }} />
        <Stack.Screen name="people-management" options={{ headerShown: false }} />
        <Stack.Screen name="contents" options={{ headerShown: false }} />
        <Stack.Screen name="drive" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
        </ProfileNameProvider>
      </NotificationsProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
