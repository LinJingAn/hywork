let ignoreResponseListenerNavUntil = 0;

export function suppressNotificationResponseNavigation(ms: number) {
  ignoreResponseListenerNavUntil = Date.now() + ms;
}

export function shouldSuppressNotificationResponseNavigation(): boolean {
  return Date.now() < ignoreResponseListenerNavUntil;
}
