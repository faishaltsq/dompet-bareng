import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { formatRupiah } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface MonthlyTrendData {
  monthKey: string; // e.g. "2026-05"
  label: string; // e.g. "Mei" or "May"
  year: number;
  income: number;
  expense: number;
}

interface FinancialTrendChartProps {
  data: MonthlyTrendData[];
  height?: number;
  onSelectMonth?: (item: MonthlyTrendData) => void;
}

export default function FinancialTrendChart({
  data,
  height = 190,
  onSelectMonth,
}: FinancialTrendChartProps) {
  const { language } = useLanguage();
  const [containerWidth, setContainerWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 5) {
      setContainerWidth(w);
    }
  };

  // Determine scale max
  const maxVal = Math.max(
    ...data.flatMap((d) => [d.income, d.expense]),
    100_000 // min ceiling to avoid divide-by-zero
  );

  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  const paddingLeft = 12;
  const paddingRight = 12;
  const paddingTop = 20;
  const paddingBottom = 28;
  const chartWidth = Math.max(containerWidth, 260);
  const chartHeight = height;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const innerWidth = chartWidth - paddingLeft - paddingRight;

  const count = Math.max(data.length, 1);
  const groupWidth = innerWidth / count;
  const barWidth = Math.min(Math.max((groupWidth - 14) / 2, 8), 24);
  const gap = 3;

  const selectedItem = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Header and Legend */}
      <View style={styles.headerRow}>
        <View style={styles.legendGroup}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.income }]} />
            <Text style={styles.legendText}>
              {language === 'en' ? 'Income' : 'Pemasukan'}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.expense }]} />
            <Text style={styles.legendText}>
              {language === 'en' ? 'Expense' : 'Pengeluaran'}
            </Text>
          </View>
        </View>

        {selectedItem && (
          <Text style={styles.selectedMonthLabel}>
            {selectedItem.label} {selectedItem.year}
          </Text>
        )}
      </View>

      {!hasData ? (
        <View style={[styles.emptyContainer, { height: chartHeight }]}>
          <Text style={styles.emptyText}>
            {language === 'en'
              ? 'No transaction trend data in this period'
              : 'Belum ada data tren transaksi dalam periode ini'}
          </Text>
        </View>
      ) : (
        <View
          style={{ width: chartWidth, height: chartHeight }}
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel="Grafik tren keuangan 6 bulan"
        >
          <Svg width={chartWidth} height={chartHeight}>
            {/* Horizontal baseline and midline */}
            <Line
              x1={paddingLeft}
              y1={paddingTop + innerHeight / 2}
              x2={chartWidth - paddingRight}
              y2={paddingTop + innerHeight / 2}
              stroke={Colors.borderLight}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Line
              x1={paddingLeft}
              y1={paddingTop + innerHeight}
              x2={chartWidth - paddingRight}
              y2={paddingTop + innerHeight}
              stroke={Colors.border}
              strokeWidth={1}
            />

            {/* Bars and month labels */}
            {data.map((item, idx) => {
              const groupCenterX = paddingLeft + idx * groupWidth + groupWidth / 2;
              const incomeHeight = Math.max((item.income / maxVal) * innerHeight, item.income > 0 ? 3 : 0);
              const expenseHeight = Math.max((item.expense / maxVal) * innerHeight, item.expense > 0 ? 3 : 0);

              const incomeX = groupCenterX - barWidth - gap / 2;
              const expenseX = groupCenterX + gap / 2;

              const incomeY = paddingTop + innerHeight - incomeHeight;
              const expenseY = paddingTop + innerHeight - expenseHeight;

              const isSelected = selectedIndex === idx;

              return (
                <React.Fragment key={item.monthKey}>
                  {/* Selection highlight background */}
                  {isSelected && (
                    <Rect
                      x={groupCenterX - groupWidth / 2 + 2}
                      y={paddingTop - 6}
                      width={groupWidth - 4}
                      height={innerHeight + 12}
                      rx={Radius.sm}
                      fill={Colors.primarySoft}
                      opacity={0.6}
                    />
                  )}

                  {/* Income Bar */}
                  {incomeHeight > 0 && (
                    <Rect
                      x={incomeX}
                      y={incomeY}
                      width={barWidth}
                      height={incomeHeight}
                      rx={3}
                      fill={Colors.income}
                      opacity={selectedIndex !== null && !isSelected ? 0.45 : 1}
                    />
                  )}

                  {/* Expense Bar */}
                  {expenseHeight > 0 && (
                    <Rect
                      x={expenseX}
                      y={expenseY}
                      width={barWidth}
                      height={expenseHeight}
                      rx={3}
                      fill={Colors.expense}
                      opacity={selectedIndex !== null && !isSelected ? 0.45 : 1}
                    />
                  )}

                  {/* Month Label */}
                  <SvgText
                    x={groupCenterX}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isSelected ? '700' : '500'}
                    fill={isSelected ? Colors.primary : Colors.textSecondary}
                  >
                    {item.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Interactive touch overlays for bars */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', paddingLeft, paddingRight }]}>
            {data.map((item, idx) => (
              <Pressable
                key={`touch-${item.monthKey}`}
                style={{ flex: 1, height: '100%' }}
                onPress={() => {
                  const next = selectedIndex === idx ? null : idx;
                  setSelectedIndex(next);
                  if (next !== null) onSelectMonth?.(item);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.label} ${item.year}: Pemasukan ${formatRupiah(item.income)}, Pengeluaran ${formatRupiah(item.expense)}`}
              />
            ))}
          </View>
        </View>
      )}

      {/* Selected Month Tooltip Detail */}
      {selectedItem && (
        <View style={styles.detailBox}>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>
              {language === 'en' ? 'Income' : 'Pemasukan'}
            </Text>
            <Text style={[styles.detailValue, { color: Colors.income }]}>
              {formatRupiah(selectedItem.income)}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>
              {language === 'en' ? 'Expense' : 'Pengeluaran'}
            </Text>
            <Text style={[styles.detailValue, { color: Colors.expense }]}>
              {formatRupiah(selectedItem.expense)}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>
              {language === 'en' ? 'Net Balance' : 'Selisih'}
            </Text>
            <Text
              style={[
                styles.detailValue,
                {
                  color:
                    selectedItem.income >= selectedItem.expense
                      ? Colors.income
                      : Colors.expense,
                },
              ]}
            >
              {formatRupiah(selectedItem.income - selectedItem.expense)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  selectedMonthLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  detailBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailCol: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
});
