import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { Colors, Motion } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface PieChartProps {
  data: PieSlice[];
  total: number;
  size?: number;
  donutRadius?: number;
  formatValue?: (val: number) => string;
  onSlicePress?: (slice: PieSlice | null) => void;
  /** Prefix "-" on displayed values (for expense tab) */
  showNegative?: boolean;
}

// Convert polar coordinates to cartesian x,y
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Build SVG arc path for a pie slice
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  // Cap to prevent full-circle rendering as zero arc
  const sweep = Math.min(endAngle - startAngle, 359.999);
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, startAngle + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

const DEFAULT_COLORS = [
  Colors.income,
  Colors.accentBlue,
  Colors.warning,
  Colors.expense,
  Colors.accentPurple,
  Colors.accentTeal,
  Colors.accentOrange,
  Colors.savings,
  Colors.primaryDark,
  Colors.accentBlue,
];

export default function PieChart({
  data,
  total,
  size = 220,
  donutRadius: holeRatio = 0.55,
  formatValue,
  onSlicePress,
  showNegative = false,
}: PieChartProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const shouldReduceMotion = useReducedMotion();
  const [activeSlice, setActiveSlice] = useState<PieSlice | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6; // outer radius (leave 6px padding for stroke)
  const innerR = r * holeRatio;

  const prefix = showNegative ? '-' : '';

  const fmt = formatValue ?? ((v: number) => {
    const millionSuffix = isEn ? 'M' : 'jt';
    const thousandSuffix = isEn ? 'K' : 'rb';
    if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}${millionSuffix}`;
    if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}${thousandSuffix}`;
    return `${prefix}${v}`;
  });

  // Build slices — filter zero-value to avoid degenerate arcs
  const nonZero = data.filter(s => s.value > 0);
  let cursor = 0;
  const slices = nonZero.map((s, i) => {
    const angle = (s.value / total) * 360;
    const path = describeArc(cx, cy, r, cursor, cursor + angle);
    const mid = cursor + angle / 2;
    const midPt = polarToCartesian(cx, cy, (r + innerR) / 2, mid);
    const start = cursor;
    cursor += angle;
    return { ...s, path, midPt, start, angle, color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] };
  });

  const highlighted = activeSlice
    ? slices.find(s => s.key === activeSlice.key) ?? null
    : null;

  function handleSlicePress(slice: PieSlice) {
    const next = activeSlice?.key === slice.key ? null : slice;
    setActiveSlice(next);
    onSlicePress?.(next);
  }

  const centerLabel = highlighted
    ? { top: highlighted.label, bottom: fmt(highlighted.value), pct: `${highlighted.percentage.toFixed(1)}%` }
    : { top: 'Total', bottom: fmt(total), pct: '' };

  if (nonZero.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {/* Donut SVG */}
      <View
        style={{ width: size, height: size }}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`Pie chart: ${nonZero.map(s => `${s.label} ${((s.value / total) * 100).toFixed(0)}%`).join(', ')}`}
      >
        <Svg width={size} height={size}>
          <G>
            {slices.map((s) => {
              const isActive = highlighted?.key === s.key;
              return (
                <PieSliceGroup
                  key={s.key}
                  slice={s}
                  isSelected={isActive}
                  hasSelection={highlighted !== null}
                  cx={cx}
                  cy={cy}
                  shouldReduceMotion={shouldReduceMotion}
                  onPress={() => handleSlicePress(s)}
                />
              );
            })}
            {/* Donut hole */}
            <Circle cx={cx} cy={cy} r={innerR} fill="white" />
          </G>
          {/* Center text */}
          <SvgText
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            fontSize={11}
            fill={Colors.textMuted}
            fontWeight="400"
          >
            {centerLabel.top}
          </SvgText>
          <SvgText
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            fontSize={13}
            fill={Colors.textDark ?? '#0F172A'}
            fontWeight="700"
          >
            {centerLabel.bottom}
          </SvgText>
          {centerLabel.pct ? (
            <SvgText
              x={cx}
              y={cy + 28}
              textAnchor="middle"
              fontSize={11}
              fill={highlighted?.color ?? Colors.primary}
              fontWeight="600"
            >
              {centerLabel.pct}
            </SvgText>
          ) : null}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.map((s) => {
          const isActive = highlighted?.key === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.legendRow, isActive && styles.legendRowActive]}
              onPress={() => handleSlicePress(s)}
              accessibilityRole="button"
              accessibilityLabel={`${s.label}: ${fmt(s.value)}, ${s.percentage.toFixed(1)}%`}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendLabel, isActive && { fontWeight: '700' }]} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={[styles.legendPct, { color: s.color }]}>
                {s.percentage.toFixed(1)}%
              </Text>
              <Text style={styles.legendVal}>{fmt(s.value)}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Deselect tap zone */}
      {highlighted && (
        <TouchableOpacity
          onPress={() => { setActiveSlice(null); onSlicePress?.(null); }}
          style={styles.clearBtn}
          accessibilityRole="button"
          accessibilityLabel={isEn ? "Reset filter, show all categories" : "Reset filter, tampilkan semua kategori"}
        >
          <Text style={styles.clearBtnText}>{isEn ? '✕ All' : '✕ Semua'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PieSliceGroup({
  slice,
  isSelected,
  hasSelection,
  cx,
  cy,
  shouldReduceMotion,
  onPress,
}: {
  slice: { key: string; path: string; color: string };
  isSelected: boolean;
  hasSelection: boolean;
  cx: number;
  cy: number;
  shouldReduceMotion: boolean | null;
  onPress: () => void;
}) {
  const targetScale = isSelected && !shouldReduceMotion ? 1.03 : 1;
  const targetOpacity = hasSelection && !isSelected ? 0.7 : 1;

  const [scale, setScale] = useState(targetScale);
  const [opacity, setOpacity] = useState(targetOpacity);
  const animRef = useRef<{ scale: number; opacity: number }>({
    scale: targetScale,
    opacity: targetOpacity,
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      setScale(targetScale);
      setOpacity(targetOpacity);
      animRef.current = { scale: targetScale, opacity: targetOpacity };
      return;
    }

    const startScale = animRef.current.scale;
    const endScale = targetScale;
    const startOpacity = animRef.current.opacity;
    const endOpacity = targetOpacity;

    if (startScale === endScale && startOpacity === endOpacity) return;

    const startTime = Date.now();
    const duration = Motion.duration.fast;
    let frameId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);

      const curScale = startScale + (endScale - startScale) * eased;
      const curOpacity = startOpacity + (endOpacity - startOpacity) * eased;

      animRef.current = { scale: curScale, opacity: curOpacity };
      setScale(curScale);
      setOpacity(curOpacity);

      if (p < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        animRef.current = { scale: endScale, opacity: endOpacity };
        setScale(endScale);
        setOpacity(endOpacity);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [targetScale, targetOpacity, shouldReduceMotion]);

  const transform = scale !== 1
    ? `translate(${cx}, ${cy}) scale(${scale}) translate(${-cx}, ${-cy})`
    : undefined;

  return (
    <G transform={transform} opacity={opacity}>
      <Path
        d={slice.path}
        fill={slice.color}
        onPress={onPress}
      />
    </G>
  );
}
const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 16,
  },
  legend: {
    width: '100%',
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  legendRowActive: {
    backgroundColor: Colors.primarySoft,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.textDark,
    fontWeight: '400',
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  legendVal: {
    fontSize: 12,
    color: Colors.textMuted,
    minWidth: 44,
    textAlign: 'right',
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
  },
  clearBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
