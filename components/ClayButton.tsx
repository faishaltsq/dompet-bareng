import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Motion } from '@/constants/theme';

export type ClayButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger';
export type ClayButtonSize = 'sm' | 'md' | 'lg';

export interface ClayButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ClayButtonVariant;
  size?: ClayButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
  haptic?: boolean;
  fullWidth?: boolean;
}

export default function ClayButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
  haptic = true,
  fullWidth = false,
}: ClayButtonProps) {
  const shouldReduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const handlePressIn = () => {
    if (disabled || loading) return;
    if (haptic && Platform.OS !== 'web') {
      try {
        Vibration.vibrate(10);
      } catch {
        // Safe fallback if unsupported
      }
    }
    if (!shouldReduceMotion) {
      scale.value = withSpring(0.95, Motion.spring.snappy);
      translateY.value = withSpring(2, Motion.spring.snappy);
    }
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    if (!shouldReduceMotion) {
      scale.value = withSpring(1, Motion.spring.bounce);
      translateY.value = withSpring(0, Motion.spring.bounce);
    }
  };

  const handleHoverIn = () => {
    if (disabled || loading || shouldReduceMotion) return;
    scale.value = withSpring(1.025, Motion.spring.snappy);
    translateY.value = withSpring(-1.5, Motion.spring.snappy);
  };

  const handleHoverOut = () => {
    if (disabled || loading || shouldReduceMotion) return;
    scale.value = withSpring(1, Motion.spring.snappy);
    translateY.value = withSpring(0, Motion.spring.snappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: shouldReduceMotion ? 1 : scale.value },
      { translateY: shouldReduceMotion ? 0 : translateY.value },
    ],
  }));

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isAccent = variant === 'accent';
  const isDanger = variant === 'danger';

  const iconColor = isPrimary
    ? '#FFFFFF'
    : isSecondary
    ? Colors.primaryDark
    : isDanger
    ? '#FFFFFF'
    : '#FFFFFF';

  const iconSizes: Record<ClayButtonSize, number> = {
    sm: 13,
    md: 15,
    lg: 18,
  };

  return (
    <Animated.View
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      <Pressable
        testID={testID}
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        // @ts-ignore - React Native Web hover support
        onHoverIn={handleHoverIn}
        // @ts-ignore
        onHoverOut={handleHoverOut}
        disabled={disabled || loading}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled: disabled || loading }}
        style={[styles.innerPressable, fullWidth && styles.fullWidth]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <View style={styles.contentRow}>
            {icon && iconPosition === 'left' && (
              <Ionicons
                name={icon}
                size={iconSizes[size]}
                color={iconColor}
                style={styles.iconLeft}
              />
            )}
            <Text
              style={[
                styles.textBase,
                styles[`text_${variant}`],
                styles[`textSize_${size}`],
                textStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {icon && iconPosition === 'right' && (
              <Ionicons
                name={icon}
                size={iconSizes[size]}
                color={iconColor}
                style={styles.iconRight}
              />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    overflow: 'visible',
  },
  fullWidth: {
    width: '100%',
  },
  innerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },
  disabled: {
    opacity: 0.5,
  },

  /* --- SIZES --- */
  size_sm: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  size_md: {
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  size_lg: {
    paddingVertical: 13,
    paddingHorizontal: 22,
  },

  /* --- VARIANTS (CLAYMORPHISM) --- */
  // 1. Primary: Rich warm caramel clay with top bevel highlight + bottom shadow rim
  primary: {
    backgroundColor: Colors.primaryDark,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.22)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(46, 24, 14, 0.28)',
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(35, 18, 10, 0.45)',
    shadowColor: '#5C2A12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 6,
  },

  // 2. Secondary: Warm porcelain cream clay with dual soft bevel
  secondary: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftWidth: 1.5,
    borderLeftColor: '#FFFFFF',
    borderRightWidth: 1.5,
    borderRightColor: '#E6D7C8',
    borderBottomWidth: 2.5,
    borderBottomColor: '#D3BFAB',
    shadowColor: '#6B3A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  // 3. Accent: Warm blue or teal clay
  accent: {
    backgroundColor: Colors.accentBlue,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 0, 0, 0.18)',
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.32)',
    shadowColor: '#2B4C6F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 5,
  },

  // 4. Danger: Coral clay
  danger: {
    backgroundColor: Colors.expense,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.35)',
    shadowColor: '#8C2B22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 5,
  },

  /* --- TYPOGRAPHY --- */
  textBase: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSize_sm: {
    fontSize: 12,
  },
  textSize_md: {
    fontSize: 13,
  },
  textSize_lg: {
    fontSize: 15,
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: Colors.primaryDark,
  },
  text_accent: {
    color: '#FFFFFF',
  },
  text_danger: {
    color: '#FFFFFF',
  },
});
