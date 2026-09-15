import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/SwipeableModal';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

export type DateFilterType = 'month' | 'day' | 'range' | 'all';

export interface DateFilterState {
  type: DateFilterType;
  label: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  monthIndex?: number; // 0-11
  year?: number;
}

interface CalendarDropdownModalProps {
  visible: boolean;
  onClose: () => void;
  currentFilter: DateFilterState;
  onSelectFilter: (filter: DateFilterState) => void;
  transactionDates?: Set<string>; // set of 'YYYY-MM-DD' strings with tx
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAY_NAMES_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarDropdownModal({
  visible,
  onClose,
  currentFilter,
  onSelectFilter,
  transactionDates = new Set(),
}: CalendarDropdownModalProps) {
  const { t, language } = useLanguage();
  const monthNames = language === 'id' ? MONTH_NAMES_ID : MONTH_NAMES_EN;
  const dayNames = language === 'id' ? DAY_NAMES_ID : DAY_NAMES_EN;

  const now = new Date();
  const [viewYear, setViewYear] = useState<number>(currentFilter.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(
    currentFilter.monthIndex !== undefined ? currentFilter.monthIndex : now.getMonth()
  );

  // Range selection temp state: rangeStart & rangeEnd as 'YYYY-MM-DD'
  const [rangeStart, setRangeStart] = useState<string | null>(currentFilter.startDate ?? null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(currentFilter.endDate ?? null);

  // Month navigation
  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }

  // Generate calendar grid for (viewYear, viewMonth)
  // Monday is index 0 in DAY_NAMES
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // getDay(): 0 = Sun, 1 = Mon ...
    let dayOfWeek = firstDay.getDay(); // 0 is Sunday
    const startOffset = (dayOfWeek + 6) % 7; // Monday-based offset (0 for Mon, 6 for Sun)

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: dStr, dayNum: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: dStr, dayNum: d, isCurrentMonth: true });
    }

    // Next month padding to fill complete weeks (multiples of 7)
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      for (let d = 1; d <= remaining; d++) {
        const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr: dStr, dayNum: d, isCurrentMonth: false });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Click on a date cell in Google Calendar style
  function handleDateClick(dateStr: string) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      // First click: start of range or single date
      setRangeStart(dateStr);
      setRangeEnd(null);
    } else {
      // Second click: end of range
      if (dateStr < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(dateStr);
      } else {
        setRangeEnd(dateStr);
      }
    }
  }

  // Quick preset shortcuts
  function applyPreset(preset: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all') {
    const today = new Date();
    if (preset === 'today') {
      const ymd = toYMD(today);
      onSelectFilter({
        type: 'day',
        label: t('today'),
        startDate: ymd,
        endDate: ymd,
      });
    } else if (preset === 'thisWeek') {
      const day = today.getDay();
      const diffMon = (day + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - diffMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      onSelectFilter({
        type: 'range',
        label: t('thisWeek'),
        startDate: toYMD(monday),
        endDate: toYMD(sunday),
      });
    } else if (preset === 'thisMonth') {
      const y = today.getFullYear();
      const m = today.getMonth();
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const endDays = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(endDays).padStart(2, '0')}`;
      onSelectFilter({
        type: 'month',
        label: `${monthNames[m]} ${y}`,
        monthIndex: m,
        year: y,
        startDate: start,
        endDate: end,
      });
    } else if (preset === 'lastMonth') {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const endDays = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(endDays).padStart(2, '0')}`;
      onSelectFilter({
        type: 'month',
        label: `${monthNames[m]} ${y}`,
        monthIndex: m,
        year: y,
        startDate: start,
        endDate: end,
      });
    } else if (preset === 'thisYear') {
      const y = today.getFullYear();
      onSelectFilter({
        type: 'range',
        label: `${t('thisYear')} (${y})`,
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        year: y,
      });
    } else if (preset === 'all') {
      onSelectFilter({
        type: 'all',
        label: t('allTime'),
      });
    }
    onClose();
  }

  // Apply custom range from calendar
  function applyCustomSelection() {
    if (!rangeStart) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;
    const isSingleDay = start === end;

    let label = '';
    if (isSingleDay) {
      const d = new Date(start + 'T00:00:00');
      label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
    } else {
      const d1 = new Date(start + 'T00:00:00');
      const d2 = new Date(end + 'T00:00:00');
      label = `${d1.getDate()}/${d1.getMonth() + 1} - ${d2.getDate()}/${d2.getMonth() + 1}`;
    }

    onSelectFilter({
      type: isSingleDay ? 'day' : 'range',
      label,
      startDate: start,
      endDate: end,
    });
    onClose();
  }

  const todayStr = toYMD(now);

  return (
    <SwipeableModal visible={visible} onClose={onClose}>
      <View style={s.modalContainer}>
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>{t('selectPeriod')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Quick Presets Horizontal Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.presetsRow}
        >
          <TouchableOpacity
            style={[s.presetChip, currentFilter.label === t('thisMonth') && s.presetChipActive]}
            onPress={() => applyPreset('thisMonth')}
          >
            <Text style={[s.presetChipText, currentFilter.label === t('thisMonth') && s.presetChipTextActive]}>
              {t('thisMonth')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.presetChip, currentFilter.label === t('today') && s.presetChipActive]}
            onPress={() => applyPreset('today')}
          >
            <Text style={[s.presetChipText, currentFilter.label === t('today') && s.presetChipTextActive]}>
              {t('today')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.presetChip, currentFilter.label === t('thisWeek') && s.presetChipActive]}
            onPress={() => applyPreset('thisWeek')}
          >
            <Text style={[s.presetChipText, currentFilter.label === t('thisWeek') && s.presetChipTextActive]}>
              {t('thisWeek')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.presetChip, s.presetChip]}
            onPress={() => applyPreset('lastMonth')}
          >
            <Text style={s.presetChipText}>{t('lastMonth')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.presetChip, s.presetChip]}
            onPress={() => applyPreset('thisYear')}
          >
            <Text style={s.presetChipText}>{t('thisYear')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.presetChip, currentFilter.type === 'all' && s.presetChipActive]}
            onPress={() => applyPreset('all')}
          >
            <Text style={[s.presetChipText, currentFilter.type === 'all' && s.presetChipTextActive]}>
              {t('allTime')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Calendar Navigation Bar (Google Calendar Month Header) */}
        <View style={s.navRow}>
          <TouchableOpacity onPress={handlePrevMonth} style={s.navArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>

          <Text style={s.navMonthText}>
            {monthNames[viewMonth]} {viewYear}
          </Text>

          <TouchableOpacity onPress={handleNextMonth} style={s.navArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Day Name Columns */}
        <View style={s.daysHeaderRow}>
          {dayNames.map((d, i) => (
            <Text key={i} style={s.dayColText}>{d}</Text>
          ))}
        </View>

        {/* Calendar Day Grid */}
        <View style={s.grid}>
          {calendarCells.map((cell, idx) => {
            const isToday = cell.dateStr === todayStr;
            const hasTx = transactionDates.has(cell.dateStr);

            // Range checks
            const isStart = rangeStart === cell.dateStr;
            const isEnd = rangeEnd === cell.dateStr;
            const isInRange =
              rangeStart && rangeEnd && cell.dateStr > rangeStart && cell.dateStr < rangeEnd;
            const isSelected = isStart || isEnd;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  s.cell,
                  isInRange && s.cellInRange,
                  isStart && rangeEnd && s.cellRangeStart,
                  isEnd && s.cellRangeEnd,
                ]}
                onPress={() => handleDateClick(cell.dateStr)}
                activeOpacity={0.7}
              >
                <View style={[
                  s.cellInner,
                  isSelected && s.cellSelected,
                  !isSelected && isToday && s.cellToday,
                ]}>
                  <Text
                    style={[
                      s.cellNum,
                      !cell.isCurrentMonth && s.cellNumDimmed,
                      isSelected && s.cellNumSelected,
                      !isSelected && isToday && s.cellNumToday,
                    ]}
                  >
                    {cell.dayNum}
                  </Text>
                  {/* Dot marker for transactions */}
                  {hasTx && (
                    <View
                      style={[
                        s.dotMarker,
                        isSelected ? { backgroundColor: '#FFFFFF' } : { backgroundColor: Colors.primary },
                      ]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action Button: Apply Custom Range */}
        {rangeStart ? (
          <View style={s.actionRow}>
            <View style={s.rangePreviewBox}>
              <Text style={s.rangePreviewLabel}>{t('customRange')}:</Text>
              <Text style={s.rangePreviewVal}>
                {rangeStart} {rangeEnd ? `→ ${rangeEnd}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={s.applyBtn} onPress={applyCustomSelection}>
              <Text style={s.applyBtnText}>{t('applyFilter')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SwipeableModal>
  );
}

const s = StyleSheet.create({
  modalContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 8,
  },
  navArrow: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  navMonthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  dayColText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%', // 7 columns
    aspectRatio: 1.05,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  cellInRange: {
    backgroundColor: '#DCFCE7', // emerald-100
  },
  cellRangeStart: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    backgroundColor: '#DCFCE7',
  },
  cellRangeEnd: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#DCFCE7',
  },
  cellInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: Colors.primary,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  cellNum: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  cellNumDimmed: {
    color: '#CBD5E1',
  },
  cellNumSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cellNumToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dotMarker: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 2,
  },
  actionRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rangePreviewBox: {
    flex: 1,
  },
  rangePreviewLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  rangePreviewVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  applyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
