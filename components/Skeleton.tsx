import React, { useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [Colors.skeletonBase, Colors.skeletonHighlight]
    );
    return { backgroundColor };
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <View style={styles.row}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={{ gap: 6, flex: 1, marginLeft: 12 }}>
            <Skeleton width={120} height={12} />
            <Skeleton width={80} height={10} />
          </View>
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
      </View>

      {/* Balance card skeleton */}
      <View style={styles.card}>
        <Skeleton width={90} height={12} />
        <Skeleton width={180} height={28} style={{ marginVertical: 8 }} />
        <View style={styles.rowBetween}>
          <Skeleton width="45%" height={40} borderRadius={12} />
          <Skeleton width="45%" height={40} borderRadius={12} />
        </View>
      </View>

      {/* Savings target card skeleton */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ gap: 8, flex: 1 }}>
            <Skeleton width={110} height={14} />
            <Skeleton width={140} height={22} />
          </View>
          <Skeleton width={50} height={50} borderRadius={25} />
        </View>
        <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 12 }} />
      </View>

      {/* Transactions list skeleton */}
      <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 16 }}>
        <Skeleton width={140} height={18} style={{ marginBottom: 4 }} />
        {[1, 2, 3, 4].map(k => (
          <View key={k} style={styles.txItem}>
            <Skeleton width={46} height={46} borderRadius={14} />
            <View style={{ flex: 1, gap: 6, marginLeft: 12 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={10} />
            </View>
            <Skeleton width={70} height={16} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
