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
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import * as Crypto from 'expo-crypto';
import {
  inspectReceiptImage,
  type ReceiptImage,
  type ScannedTransaction,
} from '@/lib/transactionInput.cjs';
import { scanTransactionImage } from '@/lib/gemini';
import { uploadPrivateReceipt } from '@/lib/receipts';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatCurrencyInput, parseCurrencyInput } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';
import ReceiptReviewModal from '@/components/ReceiptReviewModal';

const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
) => {
  if (Platform.OS === 'web') {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      if (typeof window !== 'undefined') window.alert(text);
      buttons?.[0]?.onPress?.();
    } else {
      const confirmed = typeof window !== 'undefined' ? window.confirm(text) : true;
      if (confirmed) {
        const okBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
        okBtn?.onPress?.();
      } else {
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        cancelBtn?.onPress?.();
      }
    }
    return;
  }
  Alert.alert(title, message, buttons as any);
};

async function getBase64FromUri(uri: string): Promise<string | null> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    return comma >= 0 ? uri.slice(comma + 1) : null;
  }
  if (Platform.OS === 'web' && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const str = reader.result as string;
          const comma = str.indexOf(',');
          resolve(comma >= 0 ? str.slice(comma + 1) : str);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
  return null;
}

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
  const { addTransaction, uploadReceiptImage, activeWorkspace } = useWorkspace();
  const { user } = useAuth();
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
  const [inspectedImage, setInspectedImage] = useState<ReceiptImage | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedTransaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const isExpense = type === 'expense';

  const handleSwitchType = (t: 'expense' | 'income') => {
    setType(t);
    setCategory(t === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const handleScanReceipt = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert(t('alertPermissionRequired'), t('alertGalleryPermission'));
        return;
      }
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
    } catch (pickerErr: any) {
      showAlert(
        language === 'id' ? 'Gagal Membuka File' : 'Failed to Open File',
        pickerErr?.message || ''
      );
      return;
    }

    if (result.canceled || !result.assets || !result.assets[0]) return;

    const asset = result.assets[0];
    let base64Data = asset.base64 || null;

    if (!base64Data && asset.uri) {
      base64Data = await getBase64FromUri(asset.uri);
    }

    if (!base64Data) {
      showAlert(
        language === 'id' ? 'Gagal Membaca Gambar' : 'Failed to Read Image',
        language === 'id'
          ? 'Data gambar tidak dapat dibaca. Silakan pilih file gambar JPG atau PNG.'
          : 'Image data could not be read. Please choose a JPG or PNG image file.'
      );
      return;
    }

    let inspected: ReceiptImage;
    try {
      inspected = inspectReceiptImage(base64Data);
    } catch (err: any) {
      showAlert('Format Tidak Didukung', err?.message || 'Gagal membaca gambar');
      return;
    }

    setReceiptUri(asset.uri);
    setReceiptBase64(base64Data);
    setInspectedImage(inspected);
    setScanning(true);
    setScanResult(null);

    try {
      const scanned = await scanTransactionImage(inspected, type);
      setScanResult(scanned);
      setShowReviewModal(true);
    } catch (err: any) {
      const msg = err?.message || 'Gagal mengenali dokumen';
      showAlert('Hasil Scan', `Dokumen belum berhasil dikenali otomatis (${msg}). Anda tetap bisa mengisi nominal secara manual.`);
    } finally {
      setScanning(false);
    }
  };

  const handleApplyScan = () => {
    if (!scanResult) return;
    setAmount(formatCurrencyInput(String(scanResult.amount)));
    if (scanResult.category) {
      setCategory(scanResult.category);
    }
    if (scanResult.description) {
      setDescription(scanResult.description);
    }
    setScanResult(null);
  };

  const handlePickReceipt = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert(t('alertPermissionRequired'), t('alertGalleryPermission'));
        return;
      }
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
    } catch (pickerErr: any) {
      showAlert(
        language === 'id' ? 'Gagal Membuka File' : 'Failed to Open File',
        pickerErr?.message || ''
      );
      return;
    }

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      let b64 = asset.base64 || null;
      if (!b64 && asset.uri) {
        b64 = await getBase64FromUri(asset.uri);
      }
      setReceiptUri(asset.uri);
      setReceiptBase64(b64);
      try {
        if (b64) {
          setInspectedImage(inspectReceiptImage(b64));
        }
      } catch {
        // ignore for manual attach
      }
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptUri(null);
    setReceiptBase64(null);
    setInspectedImage(null);
    setScanResult(null);
  };

  const handleAmountChange = (text: string) => {
    setAmount(formatCurrencyInput(text));
  };

  const handleSubmit = async () => {
    const num = parseCurrencyInput(amount);
    if (isNaN(num) || num <= 0) {
      showAlert(t('alertAttention'), t('alertAmountInvalid'));
      return;
    }
    setSubmitting(true);

    let imageUrl: string | null = null;
    let receiptPath: string | null = null;
    const transactionId = Crypto.randomUUID();

    if (inspectedImage && activeWorkspace && user) {
      try {
        receiptPath = await uploadPrivateReceipt(inspectedImage, {
          transactionId,
          workspaceId: activeWorkspace.id,
          userId: user.id,
        });
      } catch (err) {
        console.warn('Private receipt upload failed, trying fallback:', err);
        const proceed = await new Promise<boolean>((resolve) => {
          showAlert(
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
    } else if (receiptUri) {
      imageUrl = await uploadReceiptImage(receiptUri, receiptBase64);
      if (!imageUrl) {
        const proceed = await new Promise<boolean>((resolve) => {
          showAlert(
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

    addTransaction({
      id: transactionId,
      type,
      amount: num,
      category,
      description: description.trim() || null,
      image_url: receiptPath ? null : imageUrl,
      receipt_path: receiptPath,
      transaction_date: new Date().toLocaleDateString('en-CA'),
    }).catch(() => {
      showAlert(t('alertFailed'), t('alertTxSaveFailed'));
    });
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
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
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
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

          {/* Scan Struk / Bukti Transfer Action */}
          <Animated.View entering={FadeInDown.delay(30).duration(350)} style={s.scanBtnContainer}>
            <TouchableOpacity
              style={s.scanBtn}
              onPress={handleScanReceipt}
              disabled={scanning}
              activeOpacity={0.85}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Scan Struk atau Bukti Transfer"
            >
              {scanning ? (
                <View style={s.scanBtnInner}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={s.scanBtnText}>
                    {language === 'id' ? '  Sedang Memindai Struk...' : '  Scanning Receipt...'}
                  </Text>
                </View>
              ) : (
                <View style={s.scanBtnInner}>
                  <Ionicons name="scan-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.scanBtnText}>
                    {language === 'id' ? 'Scan Struk / Bukti Transfer' : 'Scan Receipt / Transfer'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Scan Result Card */}
          {scanResult && (
            <Animated.View entering={FadeIn.duration(250)} style={s.scanResultCard}>
              <View style={s.scanResultHeader}>
                <Ionicons name="sparkles" size={18} color={Colors.primary} />
                <Text style={s.scanResultTitle}>
                  {language === 'id' ? 'Hasil Deteksi AI' : 'AI Detection Result'}
                </Text>
              </View>
              <View style={s.scanResultBody}>
                <Text style={s.scanResultAmount}>
                  Rp {scanResult.amount.toLocaleString('id-ID')}
                </Text>
                <Text style={s.scanResultMeta}>
                  {scanResult.category} • {scanResult.description || '-'}
                </Text>
              </View>
              <View style={s.scanResultActions}>
                <TouchableOpacity
                  style={s.applyBtn}
                  onPress={handleApplyScan}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={s.applyBtnText}>
                    {language === 'id' ? 'Terapkan ke Form' : 'Apply to Form'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.discardBtn}
                  onPress={() => setScanResult(null)}
                  activeOpacity={0.8}
                >
                  <Text style={s.discardBtnText}>
                    {language === 'id' ? 'Batal' : 'Discard'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

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
                <Ionicons name="attach" size={14} color={Colors.primary} />
                <Text style={s.receiptBtnText}>{t('addReceipt')}</Text>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="camera-outline" size={13} color={Colors.textSecondary} />
                    <Text style={s.receiptPreviewLabel}>{language === 'id' ? 'Foto Struk' : 'Receipt Photo'}</Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveReceipt} style={s.receiptRemoveBtn}>
                    <Ionicons name="close" size={13} color={Colors.expense} />
                    <Text style={s.receiptRemoveBtnText}>{language === 'id' ? 'Hapus' : 'Remove'}</Text>
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
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${t('saveBtn')} ${isExpense ? t('expense') : t('income')}`}
              accessibilityState={{ disabled: submitting }}
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
      <ReceiptReviewModal
        visible={showReviewModal && !!scanResult}
        data={
          scanResult
            ? {
                amount: scanResult.amount,
                merchant: scanResult.description || '',
                category: scanResult.category || category,
                date: new Date().toISOString().split('T')[0],
                imageUri: receiptUri || undefined,
              }
            : null
        }
        onClose={() => setShowReviewModal(false)}
        onConfirm={(confirmed) => {
          setAmount(formatCurrencyInput(String(confirmed.amount)));
          if (confirmed.category) setCategory(confirmed.category);
          if (confirmed.merchant) setDescription(confirmed.merchant);
          setShowReviewModal(false);
          setScanResult(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primaryDark },
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  switchBtnExpense: {
    backgroundColor: Colors.coralSoft,
    borderColor: Colors.coralExpense,
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
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
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
    gap: 5,
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
    color: Colors.textDark,
  },

  // Receipt preview (di dalam section catatan)
  receiptPreview: {
    backgroundColor: '#FFFFFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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

  // Scan Receipt
  scanBtnContainer: {
    marginVertical: 4,
  },
  scanBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Shadows.card,
  },
  scanBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  scanResultCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 10,
    ...Shadows.card,
  },
  scanResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  scanResultBody: {
    gap: 4,
  },
  scanResultAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDark,
  },
  scanResultMeta: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  scanResultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    minHeight: 40,
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  discardBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  discardBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
