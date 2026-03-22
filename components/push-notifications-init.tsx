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
import { registerBackgroundNotificationTask } from '@/services/background-notifications';

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

    registerBackgroundNotificationTask();

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

      tokenRefreshRef.current = Notifications.addPushTokenListener(({ data }) => {
        if (data) registerTokenWithBackend(data);
      });

      listenerRef.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          onReceivedRef.current?.();
          if (__DEV__) {
            console.log(
              '[Push] Foreground notification:',
              notification.request.content.title,
              notification.request.content.body
            );
          }
        }
      );

      responseRef.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as Record<
            string,
            unknown
          >;
          onReceivedRef.current?.();

          const url = data?.url;
          if (typeof url === 'string' && url.startsWith('/')) {
            router.push(url as never);
            return;
          }

          const route = data?.route ?? data?.screen;
          if (typeof route === 'string' && route.startsWith('/')) {
            router.push(route as never);
          } else if (data?.type === 'news' && data?.newsId) {
            router.push({
              pathname: '/notifications',
              params: { highlight: String(data.newsId) },
            } as never);
          } else if (data?.slug) {
            router.push({
              pathname: '/contents',
              params: { slug: String(data.slug) },
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
