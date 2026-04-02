import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useEffect, useMemo } from "react";
import type { ImageStyle, StyleProp } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth } from "@/config/firebase";
import { useNotifications } from "@/contexts/notifications-context";
import { useProfileName } from "@/contexts/profile-name-context";
import { buildAuthenticatedImageSource } from "@/utils/profile-avatar";

const GREETING_ROW_HEIGHT = 62;

const DROPDOWN_ITEMS: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route?: string;
  logout?: boolean;
}[] = [
  { label: "Seu perfil", icon: "person-outline", route: "/profile" },
  { label: "Gerenciar conta", icon: "settings", route: "/manage-account" },
  { label: "Logout", icon: "logout", logout: true },
];

interface GreetingBarProps {
  onDotPress: () => void;
  displayName?: string;
  unreadNotificationCount?: number;
  showBackButton?: boolean;
}

export function GreetingBar({
  onDotPress,
  displayName,
  unreadNotificationCount,
  showBackButton,
}: GreetingBarProps) {
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const {
    profileName,
    profileAvatarUrl,
    profileImageAuth,
    refreshProfileName,
  } = useProfileName();

  const avatarSource = useMemo(() => {
    if (!profileAvatarUrl) return null;
    return buildAuthenticatedImageSource(profileAvatarUrl, profileImageAuth);
  }, [profileAvatarUrl, profileImageAuth]);

  // ✅ Fetch unread count on mount so badge appears immediately
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!profileName?.trim() && auth.currentUser) {
      refreshProfileName();
      const t = setTimeout(refreshProfileName, 800);
      return () => clearTimeout(t);
    }
  }, [profileName, refreshProfileName]);

  useEffect(() => {
    if (!auth.currentUser || !profileName?.trim()) return;
    if (profileAvatarUrl) return;
    const t = setTimeout(() => refreshProfileName(), 1000);
    return () => clearTimeout(t);
  }, [profileName, profileAvatarUrl, refreshProfileName]);

  const badgeCount = unreadNotificationCount ?? unreadCount;
  const passedName = displayName?.trim();
  const contextName = profileName?.trim();
  const effectiveName =
    passedName && passedName.length > 0
      ? passedName
      : contextName && contextName.length > 0
        ? contextName
        : "Luiza Vieira";
  const initial = effectiveName.charAt(0).toUpperCase();

  return (
    <View style={headerStyles.greetingRow}>
      {showBackButton ? (
        <Pressable
          style={headerStyles.greetingIconWrap}
          hitSlop={12}
          onPress={() => {
            try {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/success");
              }
            } catch {
              router.replace("/success");
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#334155" />
        </Pressable>
      ) : null}
      <View style={headerStyles.greetingAvatar}>
        {avatarSource ? (
          <Image
            source={avatarSource}
            style={headerStyles.greetingAvatarImage as StyleProp<ImageStyle>}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={headerStyles.greetingAvatarText}>{initial}</Text>
        )}
      </View>
      <Text style={headerStyles.greetingText} numberOfLines={1}>
        Olá, {effectiveName}
      </Text>
      <Pressable
        style={headerStyles.greetingIconWrap}
        hitSlop={12}
        onPress={() => router.push("/notifications")}
      >
        <MaterialIcons name="notifications-none" size={22} color="#334155" />
        {badgeCount > 0 && <View style={headerStyles.notificationBadge} />}
      </Pressable>
      <Pressable
        style={headerStyles.greetingIconWrap}
        hitSlop={12}
        onPress={onDotPress}
      >
        <MaterialIcons name="more-vert" size={22} color="#334155" />
      </Pressable>
    </View>
  );
}

export function AccountDropdownMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const dropdownTop = insets.top + GREETING_ROW_HEIGHT;

  function handleItemPress(item: (typeof DROPDOWN_ITEMS)[number]) {
    if (item.logout) {
      signOut(auth).then(() => router.replace("/(tabs)"));
    } else if (item.route) {
      router.push(item.route as never);
    }
    onClose();
  }

  if (!visible) return null;

  return (
    <View style={headerStyles.dropdownBackdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[headerStyles.dropdownAnchor, { top: dropdownTop }]}>
        <View style={headerStyles.dropdown}>
          {DROPDOWN_ITEMS.map((item) => (
            <Pressable
              key={item.label}
              style={headerStyles.dropdownItem}
              onPress={() => handleItemPress(item)}
            >
              <MaterialIcons name={item.icon} size={22} color="#334155" />
              <Text style={headerStyles.dropdownItemText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  greetingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E06C75",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  greetingAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  greetingAvatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  greetingText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  greetingIconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dropdownAnchor: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
  },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    minWidth: 200,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#334155",
  },
});
