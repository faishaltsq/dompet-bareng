import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import OtterMascot from '@/components/OtterMascot';
import { Radius } from '@/constants/theme';

export default function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  const isHomeActive = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
  const isStatsActive = pathname.includes('statistics');
  const isSettingsActive = pathname.includes('two');

  const navItems = [
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

  return (
    <View style={s.sidebar}>
      {/* 1. macOS Window Dots */}
      <View style={s.windowDots}>
        <View style={[s.dot, { backgroundColor: '#FF5F56' }]} />
        <View style={[s.dot, { backgroundColor: '#FFBD2E' }]} />
        <View style={[s.dot, { backgroundColor: '#27C93F' }]} />
      </View>

      {/* 2. Brand Header */}
      <View style={s.brandRow}>
        <View style={s.logoCircle}>
          <Ionicons name="wallet" size={20} color="#00A86B" />
        </View>
        <Text style={s.brandText}>DompetBareng</Text>
      </View>

      {/* 3. Navigation Links */}
      <View style={s.navGroup}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[s.navItem, item.active && s.navItemActive]}
            onPress={item.onPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name={item.icon as any}
              size={20}
              color={item.active ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}
            />
            <Text style={[s.navLabel, item.active && s.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 4. Bottom Mascot Motivator Card */}
      <View style={s.mascotCard}>
        <View style={s.mascotWrap}>
          <OtterMascot variant="welcome" size="sm" />
        </View>
        <Text style={s.mascotQuote}>
          Keuangan lebih mudah kalau dilakukan Bareng-bareng ❤️
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: '#062126',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  windowDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingLeft: 4,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    paddingLeft: 4,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,168,107,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  navGroup: {
    gap: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  navItemActive: {
    backgroundColor: '#00A86B',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mascotCard: {
    marginTop: 'auto',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  mascotWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotQuote: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    textAlign: 'center',
  },
});
