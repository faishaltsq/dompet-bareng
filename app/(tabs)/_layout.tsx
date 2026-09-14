import { Tabs } from 'expo-router';
import { View, ColorValue, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';

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
        color={active ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -4 },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
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
}

const styles = StyleSheet.create({
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
