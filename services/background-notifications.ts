import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
  if (error) {
    if (__DEV__) console.warn('[Push] Background task error:', error);
    return Promise.resolve();
  }
  if (data) {
    const { notification } = data as {
      notification: Notifications.Notification;
    };
    if (__DEV__) {
      console.log(
        '[Push] Background notification:',
        notification?.request?.content?.title
      );
    }
  }
  return Promise.resolve();
});

export function registerBackgroundNotificationTask() {
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) => {
    if (__DEV__) console.warn('[Push] Failed to register background task:', err);
  });
}

export { BACKGROUND_NOTIFICATION_TASK };
