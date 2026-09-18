import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function TermsOfService() {
  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: 'Ketentuan Layanan', headerShown: Platform.OS !== 'web' }} />
      <ScrollView contentContainerStyle={s.content}>
        {Platform.OS === 'web' && <Text style={s.title}>Ketentuan Layanan — DompetBareng</Text>}
        <Text style={s.updated}>Terakhir diperbarui: 18 September 2026</Text>

        <Text style={s.h2}>1. Penerimaan Ketentuan</Text>
        <Text style={s.p}>
          Dengan menggunakan DompetBareng, kamu menyetujui ketentuan ini. Jika tidak setuju, harap hentikan penggunaan aplikasi.
        </Text>

        <Text style={s.h2}>2. Penggunaan Layanan</Text>
        <Text style={s.p}>
          DompetBareng adalah aplikasi pencatatan keuangan bersama. Kamu bertanggung jawab atas keakuratan data yang kamu masukkan. Kami tidak bertanggung jawab atas keputusan keuangan yang dibuat berdasarkan data dalam aplikasi.
        </Text>

        <Text style={s.h2}>3. Akun & Keamanan</Text>
        <Text style={s.p}>
          Akun DompetBareng terhubung ke akun Google-mu. Kamu bertanggung jawab menjaga keamanan akses Google-mu. Laporkan segera jika ada akses tidak sah ke dompetbareng@gmail.com.
        </Text>

        <Text style={s.h2}>4. Dompet Bersama</Text>
        <Text style={s.p}>
          Saat membuat atau bergabung dengan dompet bersama, data transaksimu dapat dilihat oleh seluruh anggota dompet tersebut. Pastikan kamu hanya bergabung dengan dompet yang kamu percayai.
        </Text>

        <Text style={s.h2}>5. Batasan Layanan</Text>
        <Text style={s.p}>
          Layanan DompetBareng disediakan "sebagaimana adanya". Kami berupaya menjaga ketersediaan layanan namun tidak menjamin uptime 100%. Data penting sebaiknya selalu dicadangkan.
        </Text>

        <Text style={s.h2}>6. Perubahan Ketentuan</Text>
        <Text style={s.p}>
          Kami dapat memperbarui ketentuan ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui notifikasi dalam aplikasi.
        </Text>

        <Text style={s.h2}>7. Kontak</Text>
        <Text style={s.p}>Pertanyaan? Hubungi kami di dompetbareng@gmail.com.</Text>
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
