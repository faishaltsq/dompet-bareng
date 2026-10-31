import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
  Text,
  StyleSheet,
  Platform,
  DimensionValue,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  useReducedMotion,
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
import { Colors, Shadows, Radius, Motion } from '@/constants/theme';

// Re-export animations for direct use
export {
  Motion,
  FadeIn, FadeInDown, FadeInUp, FadeInLeft, FadeInRight, FadeOut,
  SlideInDown, SlideInUp, ZoomIn,
  Layout, LinearTransition,
};

export { default as ClayButton, type ClayButtonProps, type ClayButtonVariant, type ClayButtonSize } from '@/components/ClayButton';
export const SpringPresets = Motion.spring;

/** Stagger helper: generates FadeInUp with index-based delay */
export const stagger = (index: number, base = Motion.stagger.normal) =>
  FadeInUp.delay(index * base).duration(Motion.duration.slow).springify();

/** Scale-on-press wrapper / AnimatedPressable */
export interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  activeScale?: number;
  testID?: string;
  accessibilityRole?: any;
  accessibilityLabel?: string;
}

export function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  activeScale = Motion.scale.pressed,
  testID,
  accessibilityRole = 'button',
  accessibilityLabel,
}: AnimatedPressableProps) {
  const shouldReduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shouldReduceMotion ? 1 : scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          if (!disabled && !shouldReduceMotion) {
            scale.value = withSpring(activeScale, Motion.spring.snappy);
          }
        }}
        onPressOut={() => {
          if (!disabled && !shouldReduceMotion) {
            scale.value = withSpring(1, Motion.spring.snappy);
          }
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Backward compatible export for PressableScale */
export const PressableScale = AnimatedPressable;

/** FadeSlideIn: Clean enter animation for cards and sections */
export interface FadeSlideInProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeSlideIn({
  children,
  direction = 'up',
  duration = Motion.duration.normal,
  delay = 0,
  style,
}: FadeSlideInProps) {
  const shouldReduceMotion = useReducedMotion();
  let enterAnim = FadeIn.duration(duration);
  if (!shouldReduceMotion) {
    if (direction === 'up') enterAnim = FadeInUp.duration(duration);
    else if (direction === 'down') enterAnim = FadeInDown.duration(duration);
    else if (direction === 'left') enterAnim = FadeInLeft.duration(duration);
    else if (direction === 'right') enterAnim = FadeInRight.duration(duration);
  }
  if (delay > 0) enterAnim = enterAnim.delay(delay);

  return (
    <Animated.View entering={enterAnim} style={style}>
      {children}
    </Animated.View>
  );
}

/** StaggeredEntrance: Progressive enter sequence */
export function StaggeredEntrance({
  children,
  index,
  baseDelay = Motion.stagger.normal,
  duration = Motion.duration.normal,
  style,
}: {
  children: React.ReactNode;
  index: number;
  baseDelay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shouldReduceMotion = useReducedMotion();
  const anim = shouldReduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(index * baseDelay).duration(duration);

  return (
    <Animated.View entering={anim} style={style}>
      {children}
    </Animated.View>
  );
}
/** AnimatedListItem: Wraps a list row with FadeSlideIn + LinearTransition */
export interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
  maxStaggerIndex?: number;
}

export function AnimatedListItem({
  children,
  index,
  style,
  maxStaggerIndex = 8,
}: AnimatedListItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const cappedIndex = Math.min(index, maxStaggerIndex);
  const delay = cappedIndex * Motion.stagger.short;

  const entering = shouldReduceMotion
    ? FadeIn.duration(Motion.duration.fast)
    : FadeInUp.delay(delay).duration(Motion.duration.normal);

  return (
    <Animated.View
      layout={shouldReduceMotion ? undefined : LinearTransition.duration(Motion.duration.normal)}
      entering={entering}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** MotionFeedback: Subtle opacity pulse when a key changes (e.g. KPI update) */
export interface MotionFeedbackProps {
  children: React.ReactNode;
  triggerKey?: unknown;
  style?: StyleProp<ViewStyle>;
}
export function MotionFeedback({
  children,
  triggerKey,
  style,
}: MotionFeedbackProps) {
  const shouldReduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (shouldReduceMotion) return;

    opacity.value = withSequence(
      withTiming(0.9, { duration: Motion.duration.instant }),
      withTiming(1, { duration: Motion.duration.fast })
    );
  }, [triggerKey, shouldReduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shouldReduceMotion ? 1 : opacity.value,
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/** AnimatedCard: Entrance card with warm shadow */
export function AnimatedCard({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const enterAnim = shouldReduceMotion
    ? FadeIn.duration(150)
    : FadeInDown.delay(delay).duration(Motion.duration.normal);

  return (
    <Animated.View entering={enterAnim} style={[styles.cardBase, style]}>
      {children}
    </Animated.View>
  );
}

/** Animated counter for financial amounts with smooth number transition */
export function AnimatedFinanceAmount({
  value,
  style,
  prefix = 'Rp ',
  suffix = '',
  currency = 'IDR',
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  currency?: 'IDR' | 'none';
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animOpacity = useSharedValue(1);

  useEffect(() => {
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;

    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const endValue = value;

    animOpacity.value = withTiming(0.7, { duration: 80 }, () => {
      animOpacity.value = withTiming(1, { duration: 180 });
    });

    const startTime = Date.now();
    const duration = 320;
    let frameId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endValue);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, shouldReduceMotion]);
  const formatted =
    currency === 'IDR'
      ? `${displayValue < 0 ? '-' : ''}${prefix}${Math.abs(displayValue).toLocaleString('id-ID')}${suffix}`
      : `${prefix}${displayValue.toLocaleString('id-ID')}${suffix}`;

  const animStyle = useAnimatedStyle(() => ({
    opacity: animOpacity.value,
  }));

  return (
    <Animated.Text style={[style, animStyle]}>
      {formatted}
    </Animated.Text>
  );
}

/** Backward compatible export for AnimatedNumber */
export function AnimatedNumber({
  value,
  style,
  prefix = '',
  formatFn,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  formatFn?: (n: number) => string;
}) {
  return (
    <AnimatedFinanceAmount
      value={value}
      style={style}
      prefix={prefix}
      currency={formatFn ? 'none' : 'IDR'}
    />
  );
}

/** Animated progress bar: 0-100 scale, clamped fill width */
export function AnimatedProgressBar({
  progress,
  color = Colors.primary,
  trackColor = Colors.border,
  height = 8,
  borderRadius = Radius.xs,
  style,
}: {
  progress: number; // 0-100
  color?: string;
  trackColor?: string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, progress));
  const width = useSharedValue(clamped);

  useEffect(() => {
    if (shouldReduceMotion) {
      width.value = clamped;
    } else {
      width.value = withTiming(clamped, {
        duration: Motion.duration.emphasis,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [clamped, shouldReduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as DimensionValue,
  }));

  return (
    <View style={[{ height, borderRadius, backgroundColor: trackColor, overflow: 'hidden', width: '100%' }, style]}>
      <Animated.View style={[{ height, borderRadius, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

/** AnimatedTabIndicator: Sliding active indicator pill */
export function AnimatedTabIndicator({
  activeIndex,
  totalTabs,
  indicatorColor = Colors.primary,
  height = 3,
}: {
  activeIndex: number;
  totalTabs: number;
  indicatorColor?: string;
  height?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const position = useSharedValue(activeIndex);

  useEffect(() => {
    if (shouldReduceMotion) {
      position.value = activeIndex;
    } else {
      position.value = withSpring(activeIndex, Motion.spring.responsive);
    }
  }, [activeIndex, shouldReduceMotion]);

  const tabWidthPct = 100 / Math.max(1, totalTabs);
  const animStyle = useAnimatedStyle(() => ({
    left: `${position.value * tabWidthPct}%` as DimensionValue,
    width: `${tabWidthPct}%` as DimensionValue,
  }));

  return (
    <View style={styles.tabIndicatorTrack}>
      <Animated.View
        style={[
          styles.tabIndicatorPill,
          { height, backgroundColor: indicatorColor },
          animStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  tabIndicatorTrack: {
    position: 'relative',
    width: '100%',
    height: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tabIndicatorPill: {
    position: 'absolute',
    bottom: 0,
    borderRadius: 2,
  },
});
