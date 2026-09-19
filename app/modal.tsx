import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useWorkspace } from '@/context/WorkspaceContext';
import { useLanguage } from '@/context/LanguageContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatCurrencyInput, parseCurrencyInput } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';

export default function AddTransactionModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const params = useLocalSearchParams<{
    type?: string;
    amount?: string;
    category?: string;
    description?: string;
  }>();
  const { addTransaction, uploadReceiptImage } = useWorkspace();
  const scrollRef = useRef<ScrollView>(null);

  const initType = params.type === 'income' ? 'income' : 'expense';
  const [type, setType] = useState<'expense' | 'income'>(initType);
  const [amount, setAmount] = useState(
    params.amount ? formatCurrencyInput(params.amount) : ''
  );
  const [category, setCategory] = useState<string>(
    params.category ?? (initType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0])
  );
  const [description, setDescription] = useState(params.description ?? '');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const isExpense = type === 'expense';

  const handleSwitchType = (t: 'expense' | 'income') => {
    setType(t);
    setCategory(t === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const handlePickReceipt = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Dibutuhkan', 'Izinkan akses galeri untuk menambah foto struk.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
      setReceiptBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptUri(null);
    setReceiptBase64(null);
  };

  const handleAmountChange = (text: string) => {
    setAmount(formatCurrencyInput(text));
  };

  const handleSubmit = async () => {
    const num = parseCurrencyInput(amount);
    if (isNaN(num) || num <= 0) {
      Alert.alert(t('alertAttention'), t('alertAmountInvalid'));
      return;
    }
    setSubmitting(true);

    // Upload receipt first (blocking)
    let imageUrl: string | null = null;
    if (receiptUri) {
      imageUrl = await uploadReceiptImage(receiptUri, receiptBase64);
      if (!imageUrl) {
        // Upload gagal — tanya user mau lanjut tanpa gambar atau batal
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('alertReceiptUploadFailed'),
            t('alertReceiptUploadBody'),
            [
              { text: t('cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('alertReceiptSaveWithout'), onPress: () => resolve(true) },
            ],
          );
        });
        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }
    }

    // Navigate back immediately — optimistic insert handles the rest in background
    Vibration.vibrate(80);
    router.back();

    // Fire-and-forget: addTransaction sudah optimistic (instant UI update),
    // Supabase sync terjadi di background. Kalau gagal, rollback otomatis.
    addTransaction({
      type,
      amount: num,
      category,
      description: description.trim() || null,
      image_url: imageUrl,
      transaction_date: new Date().toISOString().split('T')[0],
    }).catch(() => {
      Alert.alert(t('alertFailed'), t('alertTxSaveFailed'));
    });
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('recordTxTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/*
        KeyboardAvoidingView membungkus seluruh content area.
        behavior="padding" mendorong seluruh konten ke atas
        saat keyboard muncul — tidak perlu ScrollView.dismiss trick.
      */}
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Type Switch */}
          <Animated.View entering={FadeInDown.duration(350)} style={s.switchRow}>
            <TouchableOpacity
              style={[s.switchBtn, !isExpense && s.switchBtnInactive, isExpense && s.switchBtnExpense]}
              onPress={() => handleSwitchType('expense')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-down-circle-outline"
                size={20}
                color={isExpense ? Colors.expense : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.switchText, isExpense && s.switchTextActive]}>{t('expense')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.switchBtn, isExpense && s.switchBtnInactive, !isExpense && s.switchBtnIncome]}
              onPress={() => handleSwitchType('income')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up-circle-outline"
                size={20}
                color={!isExpense ? Colors.income : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.switchText, !isExpense && s.switchTextActive]}>{t('income')}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Amount Input */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)} style={s.amountCard}>
            <Text style={s.amountCurrency}>Rp</Text>
            <TextInput
              style={[s.amountInput, { color: isExpense ? Colors.expense : Colors.income }]}
              placeholder="0"
              placeholderTextColor={Colors.borderDark}
              keyboardType="numeric"
              value={amount}
              onChangeText={handleAmountChange}
              autoFocus={!params.amount}
            />
          </Animated.View>

          {/* Category Chips */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text style={s.sectionLabel}>{t('categoryLabel')}</Text>
            <View style={s.chipsWrap}>
              {categories.map(cat => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.chip, active && {
                      backgroundColor: isExpense ? Colors.expenseSoft : Colors.incomeSoft,
                      borderColor: isExpense ? Colors.expense : Colors.income,
                    }]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[s.chipText, active && {
                      color: isExpense ? Colors.expense : Colors.income,
                      fontWeight: '700',
                    }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Catatan + Tambah Struk */}
          <Animated.View entering={FadeInDown.delay(140).duration(350)} style={s.noteSection}>
            {/* Label row: "Catatan" + tombol "+ Tambah Struk" */}
            <View style={s.noteLabelRow}>
              <Text style={s.sectionLabel}>{t('noteOptional')}</Text>
              <TouchableOpacity style={s.receiptBtn} onPress={handlePickReceipt}>
                <Text style={s.receiptBtnText}>📎 {t('addReceipt')}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.noteInput}
              placeholder={language === 'id' ? 'Misal: Makan siang soto, bayar listrik...' : 'e.g. Lunch, electricity bill...'}
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              // Scroll ke bawah saat input difokus agar tidak tertutup keyboard
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
              }}
            />

            {/* Preview struk jika sudah dipilih */}
            {receiptUri && (
              <Animated.View entering={FadeIn.duration(250)} style={s.receiptPreview}>
                <View style={s.receiptPreviewHeader}>
                  <Text style={s.receiptPreviewLabel}>📷 {language === 'id' ? 'Foto Struk' : 'Receipt Photo'}</Text>
                  <TouchableOpacity onPress={handleRemoveReceipt} style={s.receiptRemoveBtn}>
                    <Text style={s.receiptRemoveBtnText}>✕ {language === 'id' ? 'Hapus' : 'Remove'}</Text>
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: receiptUri }} style={s.receiptImg} resizeMode="cover" />
              </Animated.View>
            )}
          </Animated.View>

          {/* Save Button */}
          <Animated.View entering={FadeInDown.delay(180).duration(350)}>
            <TouchableOpacity
              style={[
                s.saveBtn,
                { backgroundColor: isExpense ? Colors.expense : Colors.income },
                submitting && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>
                  {t('saveBtn')} {isExpense ? t('expense') : t('income')}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  kav: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  content: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 24,
    gap: 18,
    // padding bawah ekstra agar save button tidak terpotong keyboard di Android
    paddingBottom: 40,
  },

  switchRow: { flexDirection: 'row', gap: 12 },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  switchBtnExpense: {
    backgroundColor: Colors.expenseSoft,
    borderColor: Colors.expense,
  },
  switchBtnIncome: {
    backgroundColor: Colors.incomeSoft,
    borderColor: Colors.income,
  },
  switchBtnInactive: { opacity: 0.55 },
  switchEmoji: { fontSize: 16 },
  switchText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  switchTextActive: { color: Colors.textDark, fontWeight: '800' },

  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  amountCurrency: { fontSize: 28, fontWeight: '800', color: Colors.textMuted },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '900', padding: 0 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // Catatan section
  noteSection: { gap: 8 },
  noteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentBlueSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accentBlue + '40',
  },
  receiptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentBlue,
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: Colors.card,
    minHeight: 80,
    textAlignVertical: 'top',
    color: Colors.textDark,
  },

  // Receipt preview (di dalam section catatan)
  receiptPreview: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  receiptPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptPreviewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  receiptRemoveBtn: {
    backgroundColor: Colors.expenseSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  receiptRemoveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.expense,
  },
  receiptImg: {
    width: '100%',
    height: 140,
    borderRadius: 10,
  },

  saveBtn: {
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.float,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
