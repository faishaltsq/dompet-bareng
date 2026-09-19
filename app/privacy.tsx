import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';

export default function PrivacyPolicy() {
  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: 'Kebijakan Privasi', headerShown: Platform.OS !== 'web' }} />
      <ScrollView contentContainerStyle={s.content}>
        {Platform.OS === 'web' && <Text style={s.title}>Kebijakan Privasi — Dompet Bareng</Text>}
        <Text style={s.updated}>Terakhir diperbarui: 18 September 2026</Text>

        <Text style={s.h2}>1. Data yang Kami Kumpulkan</Text>
        <Text style={s.p}>
          Dompet Bareng mengumpulkan data berikut melalui autentikasi Google OAuth:{'\n'}
          • Nama tampilan dan alamat email Google{'\n'}
          • Foto profil Google (opsional){'\n'}
          {'\n'}Data keuangan yang kamu catat (transaksi, kategori, deskripsi, budget) disimpan di server Supabase yang terenkripsi.
        </Text>

        <Text style={s.h2}>2. Penggunaan Data</Text>
        <Text style={s.p}>
          Data digunakan semata-mata untuk:{'\n'}
          • Menampilkan ringkasan keuangan pribadi dan bersama{'\n'}
          • Sinkronisasi antar-anggota dompet bersama{'\n'}
          • Mengirim notifikasi pengingat harian (jika diaktifkan){'\n'}
          • Fitur AI mascot (data keuangan dikirim ke model AI untuk saran, tidak disimpan oleh pihak ketiga)
        </Text>

        <Text style={s.h2}>3. Penyimpanan & Keamanan</Text>
        <Text style={s.p}>
          Semua data disimpan di Supabase (PostgreSQL) dengan Row Level Security (RLS) aktif. Setiap pengguna hanya dapat mengakses data workspace yang mereka ikuti. Komunikasi dienkripsi via HTTPS/TLS.
        </Text>

        <Text style={s.h2}>4. Berbagi Data</Text>
        <Text style={s.p}>
          Kami TIDAK menjual, menyewakan, atau membagikan data pribadimu kepada pihak ketiga untuk tujuan pemasaran. Data hanya dibagikan kepada anggota dompet bersama yang kamu undang secara eksplisit.
        </Text>

        <Text style={s.h2}>5. Hak Pengguna</Text>
        <Text style={s.p}>
          Kamu dapat:{'\n'}
          • Menghapus seluruh dompet dan data transaksi kapan saja{'\n'}
          • Keluar dari dompet bersama{'\n'}
          • Menghapus akun dengan menghubungi kami di dompetbareng@gmail.com
        </Text>

        <Text style={s.h2}>6. Kontak</Text>
        <Text style={s.p}>
          Pertanyaan tentang privasi? Hubungi kami di dompetbareng@gmail.com.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, maxWidth: 640, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '900', color: Colors.textDark, marginBottom: 8 },
  updated: { fontSize: 12, color: Colors.textMuted, marginBottom: 20 },
  h2: { fontSize: 16, fontWeight: '800', color: Colors.textDark, marginTop: 20, marginBottom: 8 },
  p: { fontSize: 14, color: Colors.textDark, lineHeight: 22 },
});
