import React from 'react';
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
import { Colors, Shadows, Radius } from '@/constants/theme';

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
}: OtterMascotProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 72;
  const source = MASCOT_SOURCES[variant] || MASCOT_SOURCES.welcome;

  const defaultLabel = `Maskot DompetBareng (${variant})`;
  const label = accessibilityLabel || (speech ? `${defaultLabel}: ${speech}` : defaultLabel);

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

      <Image
        source={source}
        style={[
          {
            width: pixelSize,
            height: pixelSize,
          },
          imageStyle,
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
