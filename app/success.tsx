import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutoLoginWebView } from '@/components/auto-login-webview';
import { AccountDropdownMenu, GreetingBar } from '@/components/app-header';
import { SideDrawer } from '@/components/side-drawer';
import { WEBVIEW_DOMAIN_URL } from '@/config/auth';

const REDIRECT_HOME = process.env.EXPO_PUBLIC_WEBVIEW_REDIRECT_HOME ?? '/';

export default function SuccessScreen() {
  const params = useLocalSearchParams<{ webRedirect?: string | string[] }>();
  const webRedirectParam = params.webRedirect;
  const webRedirectFromRoute =
    typeof webRedirectParam === 'string'
      ? webRedirectParam
      : Array.isArray(webRedirectParam)
        ? webRedirectParam[0]
        : undefined;

  const redirectUrl = useMemo(() => {
    if (
      typeof webRedirectFromRoute === 'string' &&
      webRedirectFromRoute.startsWith('/')
    ) {
      return webRedirectFromRoute;
    }
    return REDIRECT_HOME;
  }, [webRedirectFromRoute]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <GreetingBar onDotPress={openMenu} />
      <View style={styles.webContainer}>
        {WEBVIEW_DOMAIN_URL ? (
          <AutoLoginWebView
            key={redirectUrl}
            domainUrl={WEBVIEW_DOMAIN_URL}
            redirectUrl={redirectUrl}
            style={styles.webView}
          />
        ) : (
          <View style={styles.webPlaceholder}>
            <MaterialIcons name="public-off" size={40} color="#CBD5E1" />
            <Text style={styles.placeholderTitle}>URL do workspace não configurada</Text>
            <Text style={styles.placeholderSubtitle}>
              Defina EXPO_PUBLIC_WEBVIEW_DOMAIN_URL para carregar o conteúdo web.
            </Text>
          </View>
        )}
      </View>
      <AccountDropdownMenu visible={menuOpen} onClose={closeMenu} />
      <SideDrawer visible={drawerOpen} onClose={closeDrawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  webView: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  placeholderSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
