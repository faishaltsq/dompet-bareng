import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolateColor,
  useReducedMotion,
} from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import OtterMascot from '@/components/OtterMascot';
import { Radius, Colors, Motion } from '@/constants/theme';

export default function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768 && width < 1024;
  const shouldReduceMotion = useReducedMotion();
  const logoScale = useSharedValue(1);

  const isHomeActive = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
  const isStatsActive = pathname.includes('statistics');
  const isSettingsActive = pathname.includes('two');

  interface NavItemData {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    active: boolean;
    onPress: () => void;
  }

  const navItems: NavItemData[] = [
    {
      key: 'home',
      label: t('tabHome') || 'Beranda',
      icon: isHomeActive ? 'home' : 'home-outline',
      active: isHomeActive,
      onPress: () => router.push('/(tabs)'),
    },
    {
      key: 'stats',
      label: t('tabStats') || 'Statistik',
      icon: isStatsActive ? 'bar-chart' : 'bar-chart-outline',
      active: isStatsActive,
      onPress: () => router.push('/(tabs)/statistics'),
    },
    {
      key: 'settings',
      label: t('tabSettings') || 'Pengaturan',
      icon: isSettingsActive ? 'settings' : 'settings-outline',
      active: isSettingsActive,
      onPress: () => router.push('/(tabs)/two'),
    },
  ];

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shouldReduceMotion ? 1 : logoScale.value }],
  }));

  return (
    <View style={[s.sidebar, isTablet && s.sidebarTablet]}>
      {/* Brand Header — Claymorphic Logo Badge & Identity (No macOS Window Dots) */}
      <Pressable
        onPress={() => router.push('/(tabs)')}
        onPressIn={() => {
          if (!shouldReduceMotion) logoScale.value = withSpring(0.94, Motion.spring.snappy);
        }}
        onPressOut={() => {
          if (!shouldReduceMotion) logoScale.value = withSpring(1, Motion.spring.bounce);
        }}
        // @ts-ignore
        onHoverIn={() => {
          if (!shouldReduceMotion) logoScale.value = withSpring(1.04, Motion.spring.snappy);
        }}
        // @ts-ignore
        onHoverOut={() => {
          if (!shouldReduceMotion) logoScale.value = withSpring(1, Motion.spring.snappy);
        }}
        style={[s.brandRow, isTablet && s.brandRowTablet]}
        accessibilityRole="button"
        accessibilityLabel="DompetBareng Beranda"
      >
        <Animated.View style={[s.logoCircle, logoAnimStyle]}>
          <Ionicons name="wallet" size={20} color="#FFFFFF" />
        </Animated.View>
        {!isTablet && (
          <View>
            <Text style={s.brandText}>DompetBareng</Text>
            <Text style={s.brandTagline}>Finansial Keluarga</Text>
          </View>
        )}
      </Pressable>

      {/* Navigation Links */}
      <View style={[s.navGroup, isTablet && s.navGroupTablet]}>
        {navItems.map((item) => (
          <DesktopNavItem key={item.key} item={item} isTablet={isTablet} />
        ))}
      </View>

      {/* Bottom Mascot Motivator Card — Claymorphic Soft Card */}
      {isTablet ? (
        <View style={s.mascotWrapTablet}>
          <OtterMascot variant="welcome" size={32} />
        </View>
      ) : (
        <View style={s.mascotCard}>
          <View style={s.mascotWrap}>
            <OtterMascot variant="welcome" size="sm" />
          </View>
          <Text style={s.mascotQuote}>
            Keuangan lebih mudah kalau dilakukan Bareng-bareng.
          </Text>
        </View>
      )}
    </View>
  );
}

function DesktopNavItem({
  item,
  isTablet,
}: {
  item: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    active: boolean;
    onPress: () => void;
  };
  isTablet: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const progress = useSharedValue(item.active ? 1 : 0);
  const itemScale = useSharedValue(1);

  useEffect(() => {
    if (shouldReduceMotion) {
      progress.value = item.active ? 1 : 0;
    } else {
      progress.value = withTiming(item.active ? 1 : 0, {
        duration: Motion.duration.fast,
      });
    }
  }, [item.active, shouldReduceMotion]);

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 1)']
    ),
  }));

  const animatedItemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shouldReduceMotion ? 1 : itemScale.value }],
  }));

  const handlePressIn = () => {
    if (!shouldReduceMotion) {
      itemScale.value = withSpring(0.96, Motion.spring.snappy);
    }
  };

  const handlePressOut = () => {
    if (!shouldReduceMotion) {
      itemScale.value = withSpring(1, Motion.spring.bounce);
    }
  };

  const handleHoverIn = () => {
    if (!shouldReduceMotion) {
      itemScale.value = withSpring(1.02, Motion.spring.snappy);
    }
  };

  const handleHoverOut = () => {
    if (!shouldReduceMotion) {
      itemScale.value = withSpring(1, Motion.spring.snappy);
    }
  };

  return (
    <Animated.View style={animatedItemStyle}>
      <Pressable
        style={[
          s.navItem,
          isTablet && s.navItemTablet,
          item.active && s.navItemActiveClay,
        ]}
        onPress={item.onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        // @ts-ignore
        onHoverIn={handleHoverIn}
        // @ts-ignore
        onHoverOut={handleHoverOut}
        accessibilityRole="tab"
        accessibilityState={{ selected: item.active }}
        accessibilityLabel={item.label}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            s.navItemActiveLayer,
            animatedBgStyle,
          ]}
          pointerEvents="none"
        />
        <Ionicons
          name={item.icon}
          size={isTablet ? 22 : 20}
          color={item.active ? '#FFFFFF' : 'rgba(255,255,255,0.72)'}
        />
        <Animated.Text
          style={[
            s.navLabel,
            isTablet && s.navLabelTablet,
            item.active && s.navLabelActive,
            animatedTextStyle,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: Colors.sidebarBg,
    borderRightWidth: 1,
    borderRightColor: Colors.sidebarBorder,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 22,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  sidebarTablet: {
    width: 80,
    paddingHorizontal: 8,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
    paddingLeft: 4,
  },
  brandRowTablet: {
    marginBottom: 24,
    paddingLeft: 0,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.35)',
    shadowColor: '#100502',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 1,
  },
  navGroup: {
    gap: 8,
  },
  navGroupTablet: {
    gap: 10,
    width: '100%',
    alignItems: 'center',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemTablet: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
    borderRadius: Radius.lg,
    width: 66,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemActiveClay: {
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.18)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 0, 0, 0.25)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.4)',
    shadowColor: '#100502',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navItemActiveLayer: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  navLabelTablet: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mascotCard: {
    marginTop: 'auto',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.xl,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.35)',
    shadowColor: '#100502',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
    gap: 8,
  },
  mascotWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotWrapTablet: {
    marginTop: 'auto',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  mascotQuote: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    textAlign: 'center',
  },
});
