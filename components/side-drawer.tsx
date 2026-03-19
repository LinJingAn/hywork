import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';

import { useProfileName } from '@/contexts/profile-name-context';
import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;

const NAV_ITEMS = [
  'Home',
  'Institucional',
  'Gente & Gestão',
  'Conteúdos',
  'Drive',
];

const ROUTES: Record<string, string> = {
  'Home': '/success',
  'Institucional': '/institucional',
  'Gente & Gestão': '/people-management',
  'Conteúdos': '/contents',
  'Drive': '/drive',
};

const ACCOUNT_ITEMS: { label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'Seu perfil', icon: 'chat-bubble-outline' },
];

export function SideDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { profileName } = useProfileName();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);

  const prevVisible = useRef(visible);
  if (visible !== prevVisible.current) {
    prevVisible.current = visible;
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false));
    }
  }

  if (!rendered && !visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.drawerOverlay,
          { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
      >
        <SafeAreaView style={styles.drawerSafe} edges={['top']}>
          <View style={styles.drawerHeader}>
            <Image
              source={require('@/assets/hywork_logo.png')}
              style={styles.drawerLogo}
              contentFit="contain"
            />
            <Pressable hitSlop={12} onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#334155" />
            </Pressable>
          </View>

          <View style={styles.drawerNav}>
            {NAV_ITEMS.map((item) => {
              const route = ROUTES[item];
              const isActive = pathname === route || (route === '/success' && (pathname === '/' || pathname === '/(tabs)'));
              return (
                <Pressable
                  key={item}
                  style={styles.drawerNavItem}
                  onPress={() => {
                    if (route) {
                      router.push(route as never);
                      onClose();
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.drawerNavText,
                      isActive && styles.drawerNavTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.drawerDivider} />

          <View style={styles.drawerProfile}>
            <View style={[styles.drawerProfileAvatar, { backgroundColor: '#E06C75' }]}>
              <Text style={styles.drawerProfileInitial}>L</Text>
            </View>
            <View style={styles.drawerProfileInfo}>
              <Text style={styles.drawerProfileName}>{profileName?.trim() || 'Luiza Vieira'}</Text>
              <Text style={styles.drawerProfileEmail}>
                Luiza.silvavieira@live.com
              </Text>
            </View>
          </View>

          <View style={styles.drawerAccountItems}>
            {ACCOUNT_ITEMS.map((item) => {
              const isActive = item.label === 'Seu perfil' && pathname === '/profile';
              return (
                <Pressable
                  key={item.label}
                  style={styles.drawerAccountItem}
                  onPress={() => {
                    if (item.label === 'Seu perfil') {
                      router.push('/profile');
                      onClose();
                    }
                  }}
                >
                  <MaterialIcons name={item.icon} size={22} color="#64748B" />
                  <Text
                    style={[
                      styles.drawerAccountText,
                      isActive && styles.drawerAccountTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  drawerSafe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 0,
  },
  drawerLogo: {
    width: 174,
    height: 69,
  },
  drawerNav: {
    gap: 4,
  },
  drawerNavItem: {
    paddingVertical: 12,
  },
  drawerNavText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  drawerNavTextActive: {
    fontWeight: '700',
    color: '#1E293B',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 16,
    marginBottom: 24,
  },
  drawerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  drawerProfileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerProfileInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 20,
  },
  drawerProfileInfo: {
    marginLeft: 14,
    flex: 1,
  },
  drawerProfileName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1E293B',
  },
  drawerProfileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  drawerAccountItems: {
    gap: 4,
  },
  drawerAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  drawerAccountText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  drawerAccountTextActive: {
    fontWeight: '700',
    color: '#1E293B',
  },
});
