/**
 * Initializes push notifications when user is logged in.
 * Requests permission, registers token, handles notification tap (deep link).
 */
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { auth } from '@/config/firebase';
import {
  getPushToken,
  registerTokenWithBackend,
  requestNotificationPermission,
} from '@/services/push-notifications';

export type OnNotificationReceived = () => void;

interface PushNotificationsInitProps {
  onNotificationReceived?: OnNotificationReceived;
}

export function PushNotificationsInit({
  onNotificationReceived,
}: PushNotificationsInitProps) {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);
  const tokenRefreshRef = useRef<Notifications.EventSubscription | null>(null);
  const onReceivedRef = useRef(onNotificationReceived);
  onReceivedRef.current = onNotificationReceived;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    function setup(user: { email?: string | null } | null) {
      listenerRef.current?.remove();
      responseRef.current?.remove();
      tokenRefreshRef.current?.remove();
      if (!user) return;

      requestNotificationPermission().then((granted) => {
        if (!granted) return;
        return getPushToken();
      }).then((token) => {
        if (token) return registerTokenWithBackend(token);
      });

      // Re-register when FCM token is renewed
      tokenRefreshRef.current = Notifications.addPushTokenListener(({ data }) => {
        if (data) registerTokenWithBackend(data);
      });

      listenerRef.current = Notifications.addNotificationReceivedListener(() => {
        onReceivedRef.current?.();
      });

      responseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
        onReceivedRef.current?.();
        const route = data?.route ?? data?.screen;
        if (typeof route === 'string' && route.startsWith('/')) {
          router.push(route as never);
        } else if (data?.type === 'news' && data?.newsId) {
          router.push({
            pathname: '/notifications',
            params: { highlight: String(data.newsId) },
          } as never);
        } else {
          router.push('/notifications');
        }
      }
    );
    }

    const unsubscribe = onAuthStateChanged(auth, setup);
    setup(auth.currentUser);

    return () => {
      unsubscribe();
      listenerRef.current?.remove();
      responseRef.current?.remove();
      tokenRefreshRef.current?.remove();
    };
  }, []);

  return null;
}
