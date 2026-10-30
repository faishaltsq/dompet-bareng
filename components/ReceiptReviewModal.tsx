import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export interface ScannedReceiptData {
  amount: number;
  merchant?: string;
  category?: string;
  date?: string;
  imageUri?: string;
}

export interface ReceiptReviewModalProps {
  visible: boolean;
  data: ScannedReceiptData | null;
  onClose: () => void;
  onConfirm: (confirmedData: ScannedReceiptData) => void;
}

export default function ReceiptReviewModal({
  visible,
  data,
  onClose,
  onConfirm,
}: ReceiptReviewModalProps) {
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Lainnya');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (data) {
      setAmountStr(data.amount ? String(data.amount) : '');
      setMerchant(data.merchant || '');
      setCategory(data.category || 'Makanan & Minuman');
      setDate(data.date || new Date().toISOString().split('T')[0]);
    }
  }, [data]);

  if (!visible || !data) return null;

  const handleSave = () => {
    const num = parseFloat(amountStr.replace(/[^0-9]/g, '')) || 0;
    if (num <= 0) return;

    onConfirm({
      ...data,
      amount: num,
      merchant: merchant.trim(),
      category: category.trim(),
      date,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
              <Text style={styles.headerTitle}>Review Hasil Scan Struk</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.helperText}>
              Periksa dan koreksi data struk sebelum disimpan ke dompet bersama.
            </Text>

            <Text style={styles.label}>Nominal (Rp)</Text>
            <TextInput
              style={styles.input}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="numeric"
              placeholder="0"
            />

            <Text style={styles.label}>Nama Merchant / Deskripsi</Text>
            <TextInput
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Contoh: Superindo, Kopi Kenangan"
            />

            <Text style={styles.label}>Kategori</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Kategori transaksi"
            />

            <Text style={styles.label}>Tanggal Transaksi</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
              <Text style={styles.confirmBtnText}>Simpan Transaksi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    maxHeight: '85%',
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginBottom: 16,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8F5F0',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#F4EFEA',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
