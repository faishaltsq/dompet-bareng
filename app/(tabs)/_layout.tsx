import { Tabs } from 'expo-router';
import { View, Text, ColorValue, StyleSheet } from 'react-native';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ emoji, active }: { emoji: string; color: ColorValue; active: boolean }) {
  return (
    <View style={[styles.tabIconWrap, active && styles.tabIconActive]}>
      <Text style={{ fontSize: active ? 22 : 20 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -4 },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 0,
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
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => <TabIcon emoji="🏠" color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistik',
          tabBarIcon: ({ color, focused }) => <TabIcon emoji="📊" color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color, focused }) => <TabIcon emoji="⚙️" color={color} active={focused} />,
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
