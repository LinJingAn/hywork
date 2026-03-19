/**
 * Auto-login WebView per Auto Login WebView Intranet.pdf
 * Calls generate, opens loginUrl in WebView with device=app, cookies enabled.
 * If backend ignores redirectUrl and lands on /, navigates to target path after load.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { auth } from '@/config/firebase';
import { DEFAULT_TENANT_ID } from '@/config/auth';
import { generateAutoLoginUrl } from '@/services/auto-login';
import { getStoredAuthContext, refreshAuthContextWithFirebase } from '@/services/auth';

interface AutoLoginWebViewProps {
  domainUrl: string;
  redirectUrl?: string;
  requireAuth?: boolean;
  style?: object;
}

function isBaseUrl(url: string, domainUrl: string): boolean {
  try {
    const base = domainUrl.replace(/\/+$/, '');
    const u = url.replace(/\/+$/, '');
    return u === base || u === base + '/' || url.startsWith(base + '?');
  } catch {
    return false;
  }
}

export function AutoLoginWebView({
  domainUrl,
  redirectUrl = '/',
  requireAuth = true,
  style,
}: AutoLoginWebViewProps) {
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);
  const hasNavigatedToTarget = useRef(false);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoginUrl(null);

    if (!requireAuth) {
      const base = domainUrl.replace(/\/+$/, '');
      const path = redirectUrl?.startsWith('/') ? redirectUrl : `/${redirectUrl ?? ''}`;
      setLoginUrl(`${base}${path}`);
      setLoading(false);
      return;
    }

    const email = auth.currentUser?.email?.trim();
    if (!email) {
      setError('Usuário não autenticado. Faça login novamente.');
      setLoading(false);
      return;
    }

    let context = await getStoredAuthContext();
    if (!context?.tenantId) {
      const refreshed = await refreshAuthContextWithFirebase();
      context = refreshed ?? context;
    }

    const tenantId = context?.tenantId || DEFAULT_TENANT_ID;
    if (!tenantId) {
      setError('Tenant não configurado. Configure EXPO_PUBLIC_DEFAULT_TENANT_ID.');
      setLoading(false);
      return;
    }

    let idToken: string | null = null;
    try {
      idToken = await auth.currentUser?.getIdToken() ?? null;
    } catch {
      /* optional */
    }

    try {
      if (__DEV__) {
        console.log('[AutoLogin] Chamando generate...');
      }
      const result = await generateAutoLoginUrl({
        email,
        domainUrl,
        redirectUrl,
        tenantId,
        idToken: idToken ?? undefined,
      });
      if (__DEV__) {
        console.log('[AutoLogin] Generate OK, abrindo WebView...');
      }
      setLoginUrl(result.loginUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar link de auto-login.';
      setError(msg);
      if (__DEV__) {
        console.warn('[AutoLogin] Erro:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [domainUrl, redirectUrl, requireAuth]);

  useEffect(() => {
    hasNavigatedToTarget.current = false;
    loadUrl();
  }, [loadUrl]);

  const targetPath = redirectUrl?.trim() && redirectUrl !== '/' && redirectUrl !== ''
    ? (redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`)
    : null;

  const handleNavigationStateChange = useCallback(
    (nav: { url: string; loading: boolean }) => {
      if (nav.loading || !targetPath || hasNavigatedToTarget.current) return;
      if (!isBaseUrl(nav.url, domainUrl)) return;
      const base = domainUrl.replace(/\/+$/, '');
      const fullTarget = `${base}${targetPath}`;
      hasNavigatedToTarget.current = true;
      if (__DEV__) {
        console.log('[AutoLogin] Redirecionando para', fullTarget);
      }
      webRef.current?.injectJavaScript(
        `window.location.replace(${JSON.stringify(fullTarget)}); true;`
      );
    },
    [domainUrl, targetPath]
  );

  if (loading) {
    return (
      <View style={[styles.center, style]}>
        <ActivityIndicator size="large" color="#EC4899" />
        <Text style={styles.loadingText}>Preparando acesso...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, style]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!loginUrl) {
    return null;
  }

  const hideNavbarScript = `
    (function() {
      function isTopElement(el) {
        var rect = el.getBoundingClientRect();
        // Only target elements positioned near the top of the viewport
        return rect.top <= 10 && rect.height < 120;
      }
      function hideNav() {
        // Hide top header/banner selectors only
        var selectors = [
          'header', '[role="banner"]',
          '.top-bar', '.app-bar',
          '[class*="topbar"]', '[class*="TopBar"]',
          '[class*="sidebar"]', '[class*="Sidebar"]'
        ];
        selectors.forEach(function(sel) {
          try {
            document.querySelectorAll(sel).forEach(function(el) {
              if (isTopElement(el)) {
                el.style.setProperty('display', 'none', 'important');
              }
            });
          } catch(e) {}
        });
        // Hide fixed/sticky elements only if they are at the top
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          var cs = window.getComputedStyle(all[i]);
          var pos = cs.position;
          if ((pos === 'fixed' || pos === 'sticky') && parseInt(cs.top) <= 10 && parseInt(cs.bottom || '999') > 10) {
            var rect = all[i].getBoundingClientRect();
            if (rect.top <= 10 && rect.height < 120) {
              all[i].style.setProperty('display', 'none', 'important');
            }
          }
        }
        // Hide first child of body only if it looks like a top navbar
        if (document.body && document.body.children.length > 0) {
          var first = document.body.children[0];
          if (first && first.offsetHeight > 0 && first.offsetHeight < 120) {
            var rect = first.getBoundingClientRect();
            if (rect.top <= 10) {
              first.style.setProperty('display', 'none', 'important');
            }
          }
        }
      }
      hideNav();
      // Re-run after DOM changes
      var obs = new MutationObserver(function() { setTimeout(hideNav, 100); });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      // Also re-run periodically for SPAs
      setInterval(hideNav, 500);
    })();
    true;
  `;

  return (
    <WebView
      ref={webRef}
      source={{ uri: loginUrl }}
      style={[styles.webView, style]}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      injectedJavaScriptBeforeContentLoaded={hideNavbarScript}
      injectedJavaScript={hideNavbarScript}
      onNavigationStateChange={handleNavigationStateChange}
      onLoadEnd={() => {
        webRef.current?.injectJavaScript(hideNavbarScript);
        if (__DEV__) {
          console.log('[AutoLogin] WebView carregou.');
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
});
