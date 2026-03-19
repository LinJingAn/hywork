import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { PushNotificationsInit } from '@/components/push-notifications-init';
import { NotificationsProvider, useNotifications } from '@/contexts/notifications-context';
import { ProfileNameProvider } from '@/contexts/profile-name-context';
import { auth } from '@/config/firebase';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
