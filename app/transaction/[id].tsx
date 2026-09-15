import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useWorkspace } from '@/context/WorkspaceContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  formatRupiah,
  formatDateTime,
  getCategoryMeta,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';
import SwipeableModal from '@/components/SwipeableModal';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, deleteTransaction, updateTransaction } = useWorkspace();
  const { t, language } = useLanguage();

  const [isDeleting, setIsDeleting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const tx = transactions.find(t => t.id === id);

  // Edit modal state
  const [editCategory, setEditCategory] = useState(tx?.category || '');
  const [editDate, setEditDate] = useState(tx?.transaction_date || '');
  const [editDesc, setEditDesc] = useState(tx?.description || '');

  if (!tx) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={s.notFoundBox}>
          <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
          <Text style={s.notFoundText}>Transaksi tidak ditemukan.</Text>
          <TouchableOpacity style={s.backBtnFallback} onPress={() => router.back()}>
            <Text style={s.backBtnFallbackText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const meta = getCategoryMeta(tx.category);
  const isIncome = tx.type === 'income';
  const availableCategories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleOpenEdit = () => {
    setEditCategory(tx.category);
    setEditDate(tx.transaction_date);
    setEditDesc(tx.description || '');
    setEditModalVisible(true);
  };

  const handleQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') d.setDate(d.getDate() - 1);
    setEditDate(d.toISOString().slice(0, 10));
  };

  const handleAdjustDate = (days: number) => {
    try {
      const base = editDate ? new Date(editDate) : new Date();
      if (!isNaN(base.getTime())) {
        base.setDate(base.getDate() + days);
        setEditDate(base.toISOString().slice(0, 10));
      }
    } catch {}
  };

  const handleSaveEdit = async () => {
    if (!editCategory.trim()) {
      Alert.alert('Perhatian', 'Kategori transaksi tidak boleh kosong.');
      return;
    }
    const cleanDate = editDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      Alert.alert('Format Tanggal Salah', 'Gunakan format YYYY-MM-DD (contoh: 2026-09-15).');
      return;
    }

    setIsSaving(true);
    const ok = await updateTransaction(tx.id, {
      category: editCategory.trim(),
      transaction_date: cleanDate,
      description: editDesc.trim() || null,
    });
    setIsSaving(false);

    if (ok) {
      setEditModalVisible(false);
      Alert.alert('Berhasil ✅', t('updateTransactionSuccess'));
    } else {
      Alert.alert('Gagal ⚠️', t('updateTransactionFailed'));
    }
  };

  const doDelete = async () => {
    setIsDeleting(true);
    const success = await deleteTransaction(tx.id);
    setIsDeleting(false);
    if (success) {
      router.back();
    } else {
      Alert.alert('Gagal', t('deleteTransactionFailed'));
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('deleteTransactionConfirm'));
      if (confirmed) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      t('deleteTransactionBtn'),
      t('deleteTransactionConfirm'),
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: doDelete,
        },
      ]
    );
  };

  // Format jam dari created_at dan tanggal transaksi
  const createdAt = formatDateTime(tx.created_at);
  const txDate = new Date(tx.transaction_date).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isEdited = Boolean(tx.updated_at);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header: Tombol kanan atas kosong agar judul tetap di tengah */}
      <View style={[s.header, { backgroundColor: isIncome ? Colors.income : Colors.expense }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Detail Transaksi</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Amount Card */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[s.heroCard, { backgroundColor: isIncome ? Colors.income : Colors.expense }]}
        >
          <View style={[s.categoryIconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name={meta.icon || 'receipt-outline'} size={34} color="#FFFFFF" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.heroCategory}>{tx.category}</Text>
            {isEdited && (
              <View style={s.heroEditedPill}>
                <Text style={s.heroEditedPillText}>{t('editedTag')}</Text>
              </View>
            )}
          </View>
          <Text style={s.heroAmount}>
            {isIncome ? '+' : '-'}{formatRupiah(tx.amount)}
          </Text>
          <View style={[s.heroBadge, {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }]}>
            <Ionicons
              name={isIncome ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
              size={15}
              color="#FFFFFF"
            />
            <Text style={s.heroBadgeText}>
              {isIncome ? 'Pemasukan' : 'Pengeluaran'}
            </Text>
          </View>
        </Animated.View>

        {/* Detail Info Rows */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.detailCard}>
          <DetailRow
            icon="calendar-outline"
            label={t('transactionDate')}
            value={txDate}
            isEdited={isEdited}
            onPress={handleOpenEdit}
          />
          <View style={s.divider} />
          <DetailRow
            icon={meta.icon || 'pricetag-outline'}
            label={t('transactionCategory')}
            value={tx.category}
            valueColor={meta.color}
            isEdited={isEdited}
            onPress={handleOpenEdit}
          />
          <View style={s.divider} />
          <DetailRow
            icon="time-outline"
            label="Dicatat Pada"
            value={createdAt}
            subValue={tx.updated_at ? `(${t('lastEditedAt')}: ${formatDateTime(tx.updated_at)})` : undefined}
          />
          {tx.description ? (
            <>
              <View style={s.divider} />
              <DetailRow
                icon="document-text-outline"
                label="Catatan"
                value={tx.description}
              />
            </>
          ) : null}
          <View style={s.divider} />
          <DetailRow
            icon="person-outline"
            label="Dicatat oleh"
            value={tx.user_display_name || tx.user_email?.split('@')[0] || 'Anggota'}
          />
          <View style={s.divider} />
          <DetailRow
            icon="cash-outline"
            label="Nominal"
            value={formatRupiah(tx.amount)}
            valueColor={isIncome ? Colors.income : Colors.expense}
            valueBold
          />
        </Animated.View>

        {/* Struk / Receipt Image */}
        {tx.image_url ? (
          <Animated.View entering={FadeIn.delay(160).duration(400)} style={s.receiptCard}>
            <View style={s.receiptCardHeader}>
              <Ionicons name="image-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={s.receiptCardTitle}>Foto Struk / Nota</Text>
            </View>
            <Image
              source={{ uri: tx.image_url }}
              style={s.receiptImage}
              resizeMode="contain"
            />
          </Animated.View>
        ) : null}

        {/* Action Buttons: Ubah & Hapus */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.actionRow}>
          <TouchableOpacity
            style={s.editFullBtn}
            onPress={handleOpenEdit}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={s.editFullBtnText}>{t('editTransaction')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.deleteFullBtn, isDeleting && { opacity: 0.6 }]}
            onPress={handleDelete}
            disabled={isDeleting}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={Colors.expense} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Colors.expense} style={{ marginRight: 6 }} />
                <Text style={s.deleteFullBtnText}>{t('deleteTransactionBtn')}</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── MODAL UBAH TRANSAKSI ── */}
      <SwipeableModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
      >
        <Text style={s.modalTitle}>{t('editTransaction')}</Text>
        <Text style={s.modalSubtitle}>{t('editTransactionSubtitle')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {/* Kategori */}
          <Text style={s.inputLabel}>{t('transactionCategory')}</Text>
          <View style={s.categoryChipsWrap}>
            {availableCategories.map(cat => {
              const cMeta = getCategoryMeta(cat);
              const isSelected = editCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    s.catChip,
                    isSelected && { backgroundColor: cMeta.bg, borderColor: cMeta.color, borderWidth: 1.5 },
                  ]}
                  onPress={() => setEditCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cMeta.icon || 'pricetag-outline'}
                    size={15}
                    color={isSelected ? cMeta.color : Colors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      s.catChipText,
                      isSelected && { color: cMeta.color, fontWeight: '800' },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tanggal Transaksi */}
          <Text style={[s.inputLabel, { marginTop: 16 }]}>{t('transactionDate')}</Text>
          <View style={s.quickDateRow}>
            <TouchableOpacity
              style={s.quickDateBtn}
              onPress={() => handleQuickDate('today')}
              activeOpacity={0.7}
            >
              <Text style={s.quickDateBtnText}>{t('quickToday')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.quickDateBtn}
              onPress={() => handleQuickDate('yesterday')}
              activeOpacity={0.7}
            >
              <Text style={s.quickDateBtnText}>{t('quickYesterday')}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.datePickerRow}>
            <TouchableOpacity
              style={s.dateStepBtn}
              onPress={() => handleAdjustDate(-1)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.textDark} />
            </TouchableOpacity>

            <TextInput
              style={s.dateInput}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <TouchableOpacity
              style={s.dateStepBtn}
              onPress={() => handleAdjustDate(1)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
            </TouchableOpacity>
          </View>
          <Text style={s.dateHint}>Format: YYYY-MM-DD (contoh: 2026-09-15)</Text>

          {/* Catatan (Opsional) */}
          <Text style={[s.inputLabel, { marginTop: 16 }]}>Catatan (Opsional)</Text>
          <TextInput
            style={s.textInput}
            value={editDesc}
            onChangeText={setEditDesc}
            placeholder="Keterangan transaksi..."
            placeholderTextColor={Colors.textMuted}
            maxLength={100}
          />
        </ScrollView>

        {/* Action Button */}
        <TouchableOpacity
          style={[s.modalSaveBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSaveEdit}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.modalSaveBtnText}>{t('saveChangesBtn')}</Text>
          )}
        </TouchableOpacity>
      </SwipeableModal>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueColor,
  valueBold,
  isEdited,
  subValue,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  valueBold?: boolean;
  isEdited?: boolean;
  subValue?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={dr.row}>
      <View style={dr.iconWrap}>
        <Ionicons name={icon} size={18} color={Colors.textDark} />
      </View>
      <View style={dr.textWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={dr.label}>{label}</Text>
          {isEdited && (
            <View style={dr.editedTag}>
              <Text style={dr.editedTagText}>diubah</Text>
            </View>
          )}
        </View>
        <Text style={[dr.value, valueColor ? { color: valueColor } : {}, valueBold && { fontWeight: '800' }]}>
          {value}
        </Text>
        {subValue && <Text style={dr.subValue}>{subValue}</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const dr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2 },
  label: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  value: { fontSize: 15, color: Colors.textDark, fontWeight: '600', lineHeight: 21 },
  subValue: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  editedTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  editedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },

  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },

  // Hero card
  heroCard: {
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...Shadows.float,
  },
  categoryIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  heroEditedPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  heroEditedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Detail rows card
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },

  // Receipt
  receiptCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  receiptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  receiptCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  receiptImage: {
    width: '100%',
    height: 260,
    backgroundColor: Colors.borderLight,
  },

  // Action Buttons
  actionRow: {
    gap: 10,
    marginTop: 6,
  },
  editFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editFullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.expenseSoft,
    borderRadius: Radius.md,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#FFD7DB',
  },
  deleteFullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.expense,
  },

  // Fallback
  notFoundBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  notFoundText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  backBtnFallback: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  backBtnFallbackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Modal Ubah
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 8,
  },
  categoryChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickDateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  quickDateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateStepBtn: {
    width: 40,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInput: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textDark,
    backgroundColor: Colors.card,
    textAlign: 'center',
    fontWeight: '700',
  },
  dateHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  textInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textDark,
    backgroundColor: Colors.card,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    ...Shadows.card,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
