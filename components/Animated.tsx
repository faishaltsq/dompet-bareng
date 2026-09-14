import React, { useEffect } from 'react';
import { Pressable, ViewStyle, StyleProp, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  SlideInDown,
  SlideInUp,
  ZoomIn,
  Layout,
  LinearTransition,
  Easing,
} from 'react-native-reanimated';
import { Colors, Shadows } from '@/constants/theme';

// Re-export animations for direct use
export {
  FadeIn, FadeInDown, FadeInUp, FadeInLeft, FadeInRight, FadeOut,
  SlideInDown, SlideInUp, ZoomIn,
  Layout, LinearTransition,
};

/** Stagger helper: generates FadeInUp with index-based delay */
export const stagger = (index: number, base = 60) =>
  FadeInUp.delay(index * base).duration(400).springify();

/** Scale-on-press wrapper */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  activeScale = 0.96,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  activeScale?: number;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        onPressIn={() => { scale.value = withSpring(activeScale, { damping: 15, stiffness: 200 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Animated counter for financial amounts */
export function AnimatedNumber({
  value,
  style,
  prefix = '',
  formatFn,
}: {
  value: number;
  style?: any;
  prefix?: string;
  formatFn?: (n: number) => string;
}) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  // ponytail: no ReText dep — just display formatted static value, animate container opacity instead
  return (
    <Animated.Text entering={FadeIn.duration(300)} style={style}>
      {prefix}{formatFn ? formatFn(value) : value.toLocaleString('id-ID')}
    </Animated.Text>
  );
}

/** Animated progress bar */
export function AnimatedProgressBar({
  progress,
  color = Colors.primary,
  trackColor = Colors.border,
  height = 8,
  borderRadius = 4,
  style,
}: {
  progress: number; // 0-100
  color?: string;
  trackColor?: string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(100, Math.max(0, progress)), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as any,
  }));

  return (
    <View style={[{ height, borderRadius, backgroundColor: trackColor, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, borderRadius, backgroundColor: color }, fillStyle]} />
    </View>
  );
}
