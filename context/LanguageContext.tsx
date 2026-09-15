import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'id' | 'en';

const LANGUAGE_STORAGE_KEY = '@dompetbareng_app_language';

const translations = {
  id: {
    // Navigation / Tabs
    tabHome: 'Beranda',
    tabStats: 'Statistik',
    tabSettings: 'Pengaturan',

    // Common
    income: 'Pemasukan',
    expense: 'Pengeluaran',
    totalBalance: 'Total Saldo',
    budgetUsed: 'Budget Terpakai',
    record: 'Catat',
    recordBtn: 'Catat',
    switchWallet: 'Pindah Dompet',
    statisticsTab: 'Statistik',
    welcome: 'Hi, Selamat Datang',
    hiWelcome: 'Hi, Selamat Datang',
    userFallback: 'Pengguna',
    saveBtn: 'Simpan',
    close: 'Tutup',
    cancel: 'Batal',
    byAuthor: 'oleh',
    today: 'Hari Ini',
    thisWeek: 'Minggu Ini',
    thisMonth: 'Bulan Ini',
    allPeriod: 'Semua',
    allTime: 'Semua',
    recentTransactions: 'Transaksi Terakhir',
    recentTx: 'Transaksi Terakhir',
    transactionCount: 'transaksi',
    txCount: 'transaksi',
    noTransactions: 'Belum ada transaksi',
    emptyTxTitle: 'Belum ada transaksi',
    noTransactionsDesc: 'Tap tombol "+ Catat" di atas untuk mencatat pengeluaran atau pemasukan.',
    emptyTxDesc: 'Tap tombol "+ Catat" di atas untuk mencatat pengeluaran atau pemasukan.',
    getStartedTitle: 'Mulai dengan DompetBareng',
    getStartedSubtitle: 'Buat dompet pertamamu untuk mencatat keuangan pribadi atau bersama tim.',
    createWalletNow: 'Buat Dompet Sekarang',
    selectWallet: 'Pilih Dompet',
    selectWalletSubtitle: 'Beralih ke dompet bersama atau pribadi lainnya:',
    newWallet: 'Dompet Baru',
    joinOther: 'Gabung Lain',
    activeTag: 'Aktif',
    activeStatus: 'Aktif',
    roleOwner: 'Pemilik',
    roleMember: 'Anggota',

    // Modal Create Wallet
    createNewWallet: 'Buat Dompet Baru',
    createWalletTitle: 'Buat Dompet Baru',
    createWalletSubtitle: 'Atur keuangan bersama keluarga, pasangan, atau tim',
    walletNamePlaceholder: 'Misal: Kas Keluarga, Tabungan Liburan',
    createWalletBtn: 'Buat Dompet',

    // Statistics
    statsTitle: 'Analisis & Anggaran',
    analyticsTitle: 'Analisis & Anggaran',
    categoryBudgetTitle: 'Batas Anggaran Kategori',
    categoryBudgetLimits: 'Batas Anggaran Kategori',
    categoryBudgetSubtitle: 'Pantau kuota pengeluaran kategori',
    categoryBudgetLimitsSubtitle: 'Pantau kuota pengeluaran kategori',
    setBudgetBtn: 'Atur',
    setBudget: 'Atur',
    noBudgetSet: 'Belum ada batas anggaran yang diatur.',
    noBudgetYet: 'Belum ada batas anggaran yang diatur.',
    setBudgetGoal: 'Pasang Target Anggaran',
    setBudgetTarget: 'Pasang Target Anggaran',
    byCategory: 'Per Kategori',
    noDataThisMonth: 'Belum ada data transaksi di bulan ini.',
    budgetModalTitle: 'Atur Batas Anggaran',
    setBudgetTitle: 'Atur Batas Anggaran',
    budgetModalSubtitle: 'Pilih kategori dan tentukan kuota pengeluaran bulanan:',
    setBudgetSubtitle: 'Pilih kategori dan tentukan kuota pengeluaran bulanan:',
    budgetAmountPlaceholder: 'Nominal budget (contoh: 1500000)',
    budgetPlaceholder: 'Nominal budget (contoh: 1500000)',
    saveBudgetBtn: 'Simpan Anggaran',
    netBalance: 'Saldo Bersih',
    budgetSpent: 'Terpakai',
    budgetQuota: 'Batas',
    budgetRemaining: 'Sisa',
    budgetDelete: 'Hapus',
    showPieChart: 'Tampilkan Diagram Alokasi',
    hidePieChart: 'Sembunyikan Diagram',
    allocationChart: 'Alokasi Keuangan',
    allocationExpense: 'Alokasi Pengeluaran',
    allocationIncome: 'Alokasi Pemasukan',
    dateFilter: 'Filter Periode',
    selectPeriod: 'Pilih Periode',
    customRange: 'Rentang Kustom',
    applyFilter: 'Terapkan Filter',
    resetFilter: 'Reset',
    selectDate: 'Pilih Tanggal',
    startDate: 'Mulai',
    endDate: 'Sampai',
    lastMonth: 'Bulan Lalu',
    thisYear: 'Tahun Ini',
    noDataPeriod: 'Belum ada transaksi di periode ini.',
    tapSliceHint: 'Ketuk bagian diagram untuk melihat detail',

    // Settings
    settingsTitle: 'Pengaturan',
    settingsSubtitle: 'Akun, dompet, dan preferensi',
    myAccount: 'Akun Saya',
    devGuestTag: 'Tamu / Mode Dev',
    googleConnected: '✓ Akun Google Terhubung',
    googleNotConnected: 'Belum Login Google',
    signInWithGoogle: 'Masuk dengan Google',
    activeWalletHeader: 'Dompet Aktif',
    switchLabel: 'Pindah ›',
    walletSettings: 'Pengaturan Dompet',
    renameWallet: 'Ubah Nama Dompet',
    renameWalletDesc: 'Ganti nama dompet aktif ini',
    changeWalletPhoto: 'Ganti Foto Dompet',
    changeWalletPhotoDesc: 'Unggah ikon atau foto profil dompet',
    inviteMembers: 'Undang Anggota',
    inviteMembersDesc: 'Bagikan link ke keluarga atau rekan',
    leaveWallet: 'Keluar dari Dompet',
    leaveWalletDesc: 'Tinggalkan dompet bersama ini',
    deleteWallet: 'Hapus Dompet Ini',
    deleteWalletDesc: 'Hapus seluruh data dompet dan riwayat transaksi',
    walletMembersTitle: 'Anggota Dompet',
    othersSection: 'Lainnya',
    joinWallet: 'Gabung Dompet Lain',
    joinWalletDesc: 'Masukkan tautan atau kode token undangan',
    dailyReminder: 'Pengingat Harian',
    dailyReminderDesc: 'Notifikasi jam 20:00 untuk mencatat pengeluaran',
    appLanguage: 'Bahasa Aplikasi',
    testNotification: 'Test Notifikasi',
    testNotificationDesc: 'Kirim notifikasi uji dalam 3 detik',
    testBtn: 'Coba',
    logOut: 'Keluar dari Akun',
    editProfileTitle: 'Ubah Nama Profil',
    editProfileSubtitle: 'Nama ini akan muncul pada transaksi dan daftar anggota dompet bersama.',
    saveNameBtn: 'Simpan Nama',
    renameWalletTitle: 'Ubah Nama Dompet',
    saveChangesBtn: 'Simpan Perubahan',
    joinWalletTitle: 'Gabung Dompet Lain',
    joinWalletSubtitle: 'Tempel tautan undangan atau kode token yang kamu terima:',
    joinWalletBtn: 'Lanjut Gabung',
    kickMemberTitle: 'Keluarkan Anggota',
    kickReasonLabel: 'Alasan Dikeluarkan (dikirim ke anggota via notifikasi):',
    kickReasonPlaceholder: 'Tuliskan alasan (misal: Tidak aktif, salah gabung, dll)...',
    kickConfirmBtn: 'Ya, Keluarkan & Beri Tahu',

    // Modal Catat Transaksi
    recordTxTitle: 'Catat Transaksi',
    categoryLabel: 'Kategori',
    noteOptional: 'Catatan (Opsional)',
    addReceipt: 'Tambah Struk',

    // Notifications
    notificationsTitle: 'Notifikasi',
    markAllAsRead: 'Tandai Dibaca',
    noNotifications: 'Belum Ada Notifikasi',
    noNotificationsDesc: 'Pemberitahuan terkait aktivitas dompetmu akan muncul di sini.',
    adminNoteLabel: 'Catatan dari Pengurus/Admin:',
  },
  en: {
    // Navigation / Tabs
    tabHome: 'Home',
    tabStats: 'Stats',
    tabSettings: 'Settings',

    // Common
    income: 'Income',
    expense: 'Expense',
    totalBalance: 'Total Balance',
    budgetUsed: 'Budget Used',
    record: 'Add',
    recordBtn: 'Add',
    switchWallet: 'Switch Wallet',
    statisticsTab: 'Statistics',
    welcome: 'Welcome back',
    hiWelcome: 'Welcome back',
    userFallback: 'User',
    saveBtn: 'Save',
    close: 'Close',
    cancel: 'Cancel',
    byAuthor: 'by',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    allPeriod: 'All',
    allTime: 'All',
    recentTransactions: 'Recent Transactions',
    recentTx: 'Recent Transactions',
    transactionCount: 'transactions',
    txCount: 'transactions',
    noTransactions: 'No transactions yet',
    emptyTxTitle: 'No transactions yet',
    noTransactionsDesc: 'Tap "+ Add" button above to record your income or expenses.',
    emptyTxDesc: 'Tap "+ Add" button above to record your income or expenses.',
    getStartedTitle: 'Get Started with DompetBareng',
    getStartedSubtitle: 'Create your first wallet to track personal or team finances together.',
    createWalletNow: 'Create Wallet Now',
    selectWallet: 'Select Wallet',
    selectWalletSubtitle: 'Switch to another shared or personal wallet:',
    newWallet: 'New Wallet',
    joinOther: 'Join Other',
    activeTag: 'Active',
    activeStatus: 'Active',
    roleOwner: 'Owner',
    roleMember: 'Member',

    // Modal Create Wallet
    createNewWallet: 'Create New Wallet',
    createWalletTitle: 'Create New Wallet',
    createWalletSubtitle: 'Manage shared finances with family, partner, or team',
    walletNamePlaceholder: 'e.g., Family Budget, Trip Savings',
    createWalletBtn: 'Create Wallet',

    // Statistics
    statsTitle: 'Analysis & Budget',
    analyticsTitle: 'Analysis & Budget',
    categoryBudgetTitle: 'Category Budget Limits',
    categoryBudgetLimits: 'Category Budget Limits',
    categoryBudgetSubtitle: 'Track category spending limits',
    categoryBudgetLimitsSubtitle: 'Track category spending limits',
    setBudgetBtn: 'Set',
    setBudget: 'Set',
    noBudgetSet: 'No budget limits set yet.',
    noBudgetYet: 'No budget limits set yet.',
    setBudgetGoal: 'Set Budget Target',
    setBudgetTarget: 'Set Budget Target',
    byCategory: 'By Category',
    noDataThisMonth: 'No transactions recorded this month.',
    budgetModalTitle: 'Set Budget Limit',
    setBudgetTitle: 'Set Budget Limit',
    budgetModalSubtitle: 'Pick a category and set monthly spending limit:',
    setBudgetSubtitle: 'Pick a category and set monthly spending limit:',
    budgetAmountPlaceholder: 'Budget amount (e.g. 1500000)',
    budgetPlaceholder: 'Budget amount (e.g. 1500000)',
    saveBudgetBtn: 'Save Budget',
    netBalance: 'Net Balance',
    budgetSpent: 'Spent',
    budgetQuota: 'Limit',
    budgetRemaining: 'Left',
    budgetDelete: 'Delete',
    showPieChart: 'Show Allocation Chart',
    hidePieChart: 'Hide Chart',
    allocationChart: 'Financial Allocation',
    allocationExpense: 'Expense Allocation',
    allocationIncome: 'Income Allocation',
    dateFilter: 'Period Filter',
    selectPeriod: 'Select Period',
    customRange: 'Custom Range',
    applyFilter: 'Apply Filter',
    resetFilter: 'Reset',
    selectDate: 'Select Date',
    startDate: 'Start',
    endDate: 'End',
    lastMonth: 'Last Month',
    thisYear: 'This Year',
    noDataPeriod: 'No transactions in this period.',
    tapSliceHint: 'Tap a slice to see details',

    // Settings
    settingsTitle: 'Settings',
    settingsSubtitle: 'Account, wallets, and preferences',
    myAccount: 'My Account',
    devGuestTag: 'Guest / Dev Mode',
    googleConnected: '✓ Google Account Connected',
    googleNotConnected: 'Not Connected to Google',
    signInWithGoogle: 'Sign In with Google',
    activeWalletHeader: 'Active Wallet',
    switchLabel: 'Switch ›',
    walletSettings: 'Wallet Settings',
    renameWallet: 'Rename Wallet',
    renameWalletDesc: 'Change active wallet name',
    changeWalletPhoto: 'Change Wallet Photo',
    changeWalletPhotoDesc: 'Upload custom icon or wallet photo',
    inviteMembers: 'Invite Members',
    inviteMembersDesc: 'Share invite link to family or colleagues',
    leaveWallet: 'Leave Wallet',
    leaveWalletDesc: 'Leave this shared wallet',
    deleteWallet: 'Delete Wallet',
    deleteWalletDesc: 'Delete wallet and all transaction history',
    walletMembersTitle: 'Wallet Members',
    othersSection: 'Others',
    joinWallet: 'Join Another Wallet',
    joinWalletDesc: 'Enter invite link or token code',
    dailyReminder: 'Daily Reminder',
    dailyReminderDesc: 'Notification at 20:00 to log daily expenses',
    appLanguage: 'App Language',
    testNotification: 'Test Notification',
    testNotificationDesc: 'Send a test notification in 3 seconds',
    testBtn: 'Test',
    logOut: 'Sign Out',
    editProfileTitle: 'Edit Profile Name',
    editProfileSubtitle: 'This name appears on transactions and member lists.',
    saveNameBtn: 'Save Name',
    renameWalletTitle: 'Rename Wallet',
    saveChangesBtn: 'Save Changes',
    joinWalletTitle: 'Join Another Wallet',
    joinWalletSubtitle: 'Paste the invite link or token code you received:',
    joinWalletBtn: 'Join Wallet',
    kickMemberTitle: 'Remove Member',
    kickReasonLabel: 'Reason for removal (sent to member via notification):',
    kickReasonPlaceholder: 'State reason (e.g., Inactive, joined by mistake)...',
    kickConfirmBtn: 'Yes, Remove & Notify',

    // Modal Catat Transaksi
    recordTxTitle: 'Record Transaction',
    categoryLabel: 'Category',
    noteOptional: 'Notes (Optional)',
    addReceipt: 'Add Receipt',

    // Notifications
    notificationsTitle: 'Notifications',
    markAllAsRead: 'Mark All as Read',
    noNotifications: 'No Notifications',
    noNotificationsDesc: 'Updates regarding your wallet activities will appear here.',
    adminNoteLabel: 'Note from Admin:',
  },
};

export type TranslationKey = keyof typeof translations.id;

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'id',
  setLanguage: async () => {},
  t: (key: TranslationKey) => translations.id[key] ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('id');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then(saved => {
        if (saved === 'id' || saved === 'en') {
          setLanguageState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback(async (newLang: AppLanguage) => {
    setLanguageState(newLang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = translations[language] || translations.id;
      return dict[key] ?? translations.id[key] ?? (key as string);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
