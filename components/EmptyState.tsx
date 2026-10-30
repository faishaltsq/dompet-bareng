import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import OtterMascot, { OtterVariant, OtterSize } from '@/components/OtterMascot';

export interface EmptyStateProps {
  mascot?: OtterVariant;
  mascotSize?: OtterSize;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export default function EmptyState({
  mascot = 'sleeping',
  mascotSize = 'lg',
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <OtterMascot
        variant={mascot}
        size={compact ? 'md' : mascotSize}
        style={styles.mascot}
      />
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>
      ) : null}
      {onAction && actionLabel ? (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  containerCompact: {
    paddingVertical: 24,
  },
  mascot: {
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  subtitleCompact: {
    fontSize: 12,
  },
  actionBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
