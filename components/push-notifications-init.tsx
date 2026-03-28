import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { auth } from '@/config/firebase';
import { registerBackgroundNotificationTask } from '@/services/background-notifications';
import { getNotificationTapTarget } from '@/services/notification-navigation';
import { shouldSuppressNotificationResponseNavigation } from '@/services/notification-open-dedup';
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
          if (shouldSuppressNotificationResponseNavigation()) {
            return;
          }
          const data = response.notification.request.content.data as Record<
            string,
            unknown
          >;
          onReceivedRef.current?.();
          queueMicrotask(() => {
            router.push(getNotificationTapTarget(data) as never);
          });
        }
      );
    }

    // Firebase invokes this listener immediately with the current user — no extra setup() call.
    const unsubscribe = onAuthStateChanged(auth, setup);

    return () => {
      unsubscribe();
      listenerRef.current?.remove();
      responseRef.current?.remove();
      tokenRefreshRef.current?.remove();
    };
  }, []);

  return null;
}
