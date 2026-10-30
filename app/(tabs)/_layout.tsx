import { Tabs } from 'expo-router';
import { View, ColorValue, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import DesktopSidebar from '@/components/DesktopSidebar';

function TabIcon({
  name,
  nameFocused,
  color,
  active,
}: {
  name: keyof typeof Ionicons.glyphMap;
  nameFocused: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  active: boolean;
}) {
  return (
    <View style={[styles.tabIconWrap, active && styles.tabIconActive]}>
      <Ionicons
        name={active ? nameFocused : name}
        size={22}
        color={active ? Colors.forestGreen : Colors.textMuted}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);

  const tabsContent = (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.forestGreen,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -4 },
        tabBarStyle: isLargeScreen
          ? { display: 'none' }
          : {
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: '#E2E8F0',
              height: tabBarHeight,
              paddingBottom: Math.max(insets.bottom, 8),
              paddingTop: 6,
              ...Shadows.header,
            },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" nameFocused="home" color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t('tabStats'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bar-chart-outline" nameFocused="bar-chart" color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: t('tabSettings'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings-outline" nameFocused="settings" color={color} active={focused} />
          ),
        }}
      />
      {/* Tab AI dihapus — diganti floating MascotOverlay di _layout.tsx */}
    </Tabs>
  );

  if (isLargeScreen) {
    return (
      <View style={styles.desktopRoot}>
        <DesktopSidebar />
        <View style={styles.desktopMainContent}>
          {tabsContent}
        </View>
      </View>
    );
  }

  return tabsContent;
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F0F8F6',
    height: '100%',
  },
  desktopMainContent: {
    flex: 1,
    height: '100%',
  },
  tabIconWrap: {
    width: 38,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
  },
});
