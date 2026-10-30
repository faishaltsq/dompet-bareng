import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
  TextStyle,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  useReducedMotion,
  FadeIn,
} from 'react-native-reanimated';
import { Colors, Shadows, Radius, Motion } from '@/constants/theme';

export type OtterVariant =
  | 'welcome'
  | 'happy'
  | 'rich'
  | 'thinking'
  | 'crying'
  | 'panic'
  | 'reminder'
  | 'sleeping';

export type OtterSize = 'sm' | 'md' | 'lg' | 'xl' | number;

export const MASCOT_SOURCES: Record<OtterVariant, any> = {
  welcome: require('../mascot/otter-welcome.png'),
  happy: require('../mascot/otter-happy.png'),
  rich: require('../mascot/otter-rich.png'),
  thinking: require('../mascot/otter-thinking.png'),
  crying: require('../mascot/otter-crying.png'),
  panic: require('../mascot/otter-panic.png'),
  reminder: require('../mascot/otter-reminder.png'),
  sleeping: require('../mascot/otter-sleeping.png'),
};

export const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'xl', number> = {
  sm: 48,
  md: 72,
  lg: 104,
  xl: 140,
};

export interface OtterMascotProps {
  variant?: OtterVariant;
  size?: OtterSize;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  speech?: string;
  speechPosition?: 'top' | 'right' | 'bottom';
  speechStyle?: StyleProp<ViewStyle>;
  speechTextStyle?: StyleProp<TextStyle>;
  bubbleStyle?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
  animated?: boolean;
}

export default function OtterMascot({
  variant = 'welcome',
  size = 'md',
  style,
  imageStyle,
  speech,
  speechPosition = 'top',
  speechStyle,
  speechTextStyle,
  bubbleStyle,
  accessible = true,
  accessibilityLabel,
  animated = true,
}: OtterMascotProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 72;
  const source = MASCOT_SOURCES[variant] || MASCOT_SOURCES.welcome;
  const shouldReduceMotion = useReducedMotion();

  const defaultLabel = `Maskot DompetBareng (${variant})`;
  const label = accessibilityLabel || (speech ? `${defaultLabel}: ${speech}` : defaultLabel);

  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prevVariantRef = useRef(variant);

  useEffect(() => {
    if (!animated || shouldReduceMotion) {
      scale.value = 1;
      translateY.value = 0;
      rotation.value = 0;
      opacity.value = 1;
      prevVariantRef.current = variant;
      return;
    }

    // Trigger one-time restrained entrance motion based on emotion variant
    if (variant === 'welcome') {
      scale.value = withSequence(
        withTiming(0.92, { duration: 0 }),
        withSpring(1, { damping: 14, stiffness: 200 })
      );
      translateY.value = withSequence(
        withTiming(-4, { duration: 120 }),
        withSpring(0, { damping: 14, stiffness: 200 })
      );
    } else if (variant === 'happy') {
      scale.value = withSequence(
        withTiming(1.06, { duration: 150 }),
        withSpring(1, { damping: 12, stiffness: 220 })
      );
    } else if (variant === 'rich') {
      translateY.value = withSequence(
        withTiming(-6, { duration: 140 }),
        withSpring(0, { damping: 12, stiffness: 200 })
      );
    } else if (variant === 'thinking') {
      rotation.value = withSequence(
        withTiming(-3, { duration: 180 }),
        withTiming(0, { duration: 220 })
      );
    } else if (variant === 'reminder') {
      rotation.value = withSequence(
        withTiming(-3, { duration: 120 }),
        withTiming(3, { duration: 140 }),
        withTiming(0, { duration: 120 })
      );
    } else if (variant === 'panic') {
      // Non-looping, brief 240ms attention shake
      translateY.value = withSequence(
        withTiming(-2, { duration: 60 }),
        withTiming(2, { duration: 60 }),
        withTiming(-1, { duration: 60 }),
        withTiming(0, { duration: 60 })
      );
    } else if (variant === 'crying') {
      opacity.value = withSequence(
        withTiming(0.7, { duration: 0 }),
        withTiming(1, { duration: 300 })
      );
    } else if (variant === 'sleeping') {
      opacity.value = withSequence(
        withTiming(0.8, { duration: 0 }),
        withTiming(1, { duration: 350 })
      );
    }

    prevVariantRef.current = variant;
  }, [variant, animated, shouldReduceMotion]);

  const animatedMascotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const renderBubble = () => {
    if (!speech) return null;
    return (
      <View
        style={[
          styles.speechBubble,
          speechPosition === 'top' && styles.bubbleTop,
          speechPosition === 'right' && styles.bubbleRight,
          speechPosition === 'bottom' && styles.bubbleBottom,
          bubbleStyle,
        ]}
      >
        <Text style={[styles.speechText, speechTextStyle]}>{speech}</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        speechPosition === 'right' && styles.containerRow,
        style,
      ]}
      accessible={accessible}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {speech && speechPosition === 'top' && renderBubble()}

      <Animated.Image
        source={source}
        style={[
          {
            width: pixelSize,
            height: pixelSize,
          },
          imageStyle,
          animatedMascotStyle,
        ]}
        resizeMode="contain"
      />

      {speech && (speechPosition === 'right' || speechPosition === 'bottom') && renderBubble()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  speechBubble: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
    maxWidth: 220,
  },
  bubbleTop: {
    marginBottom: 8,
  },
  bubbleBottom: {
    marginTop: 8,
  },
  bubbleRight: {
    flexShrink: 1,
  },
  speechText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
    lineHeight: 16,
    textAlign: 'center',
  },
});
