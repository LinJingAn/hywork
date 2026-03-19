import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutoLoginWebView } from '@/components/auto-login-webview';
import { AccountDropdownMenu, GreetingBar } from '@/components/app-header';
import { WEBVIEW_DOMAIN_URL } from '@/config/auth';

const REDIRECT_INSTITUCIONAL = process.env.EXPO_PUBLIC_WEBVIEW_REDIRECT_INSTITUCIONAL ?? '/apresentacao-corporativa';

export default function InstitucionalScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <GreetingBar onDotPress={openMenu} />
      <View style={styles.webContainer}>
        <AutoLoginWebView
          domainUrl={WEBVIEW_DOMAIN_URL}
          redirectUrl={REDIRECT_INSTITUCIONAL}
          style={styles.webView}
        />
      </View>
      <AccountDropdownMenu visible={menuOpen} onClose={closeMenu} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
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
