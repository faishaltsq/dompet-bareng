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
    delete: 'Hapus',
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
    editBudgetTitle: 'Ubah Batas Anggaran',
    editBudgetSubtitle: 'Ubah kategori atau batas pengeluaran bulanan:',
    deleteBudgetConfirm: 'Hapus batas anggaran untuk kategori ini?',
    deleteBudgetBtn: 'Hapus Anggaran Ini',
    editBudget: 'Ubah',
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
    checkUpdate: 'Periksa Pembaruan',
    checkUpdateDesc: 'Cek & terapkan pembaruan aplikasi terbaru (OTA)',
    checkUpdateBtn: 'Periksa',
    updateChecking: 'Memeriksa...',
    updateAvailable: 'Ada pembaruan! Mengunduh...',
    updateNone: 'Aplikasi sudah terbaru.',
    updateApplied: 'Pembaruan diterapkan!',
    updateNotSupported: 'OTA tidak aktif di mode ini.',
    updateError: 'Gagal memeriksa update.',
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

    // Edit & Detail Transaksi
    editTransaction: 'Ubah Transaksi',
    editTransactionSubtitle: 'Perbarui tanggal atau kategori transaksi ini',
    transactionDate: 'Tanggal Transaksi',
    transactionCategory: 'Kategori Transaksi',
    editedTag: 'diubah',
    lastEditedAt: 'Terakhir Diubah',
    deleteTransactionConfirm: 'Apakah kamu yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.',
    deleteTransactionSuccess: 'Transaksi berhasil dihapus.',
    deleteTransactionFailed: 'Gagal menghapus transaksi dari server.',
    updateTransactionSuccess: 'Perubahan transaksi berhasil disimpan.',
    updateTransactionFailed: 'Gagal menyimpan perubahan transaksi.',
    deleteTransactionBtn: 'Hapus Transaksi Ini',
    quickToday: 'Hari Ini',
    quickYesterday: 'Kemarin',
    dateFormatHint: 'Format: YYYY-MM-DD (contoh: 2026-09-18)',

    // Alert Dialogs
    alertSuccess: 'Berhasil',
    alertFailed: 'Gagal',
    alertError: 'Error',
    alertDeleteWallet: 'Hapus Dompet?',
    alertDeleteWalletBody: 'Seluruh data transaksi di dompet akan dihapus permanen.',
    alertDeleteWalletBtn: 'Hapus Dompet',
    alertDeleteWalletFailed: 'Gagal menghapus dompet. Hanya pembuat dompet yang dapat menghapus.',
    alertLeaveWallet: 'Keluar dari Dompet?',
    alertLeaveWalletBody: 'Kamu tidak akan dapat mengakses riwayat transaksi lagi.',
    alertLeaveWalletBtn: 'Keluar Dompet',
    alertLeaveWalletFailed: 'Tidak dapat keluar dari dompet.',
    alertProfileUpdated: 'Nama profil berhasil diperbarui.',
    alertProfileUpdateFailed: 'Tidak dapat memperbarui nama profil.',
    alertPermissionRequired: 'Izin Dibutuhkan',
    alertGalleryPermission: 'Izinkan akses galeri untuk mengganti foto dompet.',
    alertKickSuccess: 'Anggota telah dikeluarkan dan diberi notifikasi.',
    alertKickFailed: 'Tidak dapat mengeluarkan anggota. Pastikan kamu memiliki hak admin.',
    alertSystemError: 'Terjadi kesalahan sistem.',
    alertReceiptUploadFailed: 'Gagal Unggah Struk',
    alertReceiptUploadBody: 'Gambar struk gagal diunggah. Simpan transaksi tanpa struk?',
    alertReceiptSaveWithout: 'Simpan Tanpa Struk',
    alertTxSaveFailed: 'Transaksi gagal disimpan. Coba lagi.',
    alertAmountInvalid: 'Masukkan nominal yang valid.',
    alertAttention: 'Perhatian',

    // Budget health badges
    budgetHealthy: 'Sehat',
    budgetWarning: 'Waspada',
    budgetCritical: 'Kritis',

    // Budget overbudget label
    budgetOverbudget: 'Overbudget',
    labelBudgetAmount: 'Nominal Batas Anggaran',

    // Transaction detail labels
    labelRecordedAt: 'Dicatat Pada',
    labelNote: 'Catatan',
    labelRecordedBy: 'Dicatat oleh',
    labelAmount: 'Nominal',
    labelReceiptPhoto: 'Foto Struk / Nota',
    labelTapZoom: 'Tap untuk memperbesar',
    labelTapClose: 'Tap untuk menutup',
    labelAmountRp: 'Nominal (Rp)',
    labelMemberSuffix: '(Kamu)',

    // Transaction detail header
    detailTransactionTitle: 'Detail Transaksi',

    // Alert: create wallet failed
    alertCreateWalletFailed: 'Tidak dapat membuat dompet. Coba lagi.',

    // Alert: cannot change wallet name
    alertRenameWalletFailed: 'Tidak dapat mengubah nama dompet.',

    // Alert: cannot upload workspace image
    alertUploadImageFailed: 'Tidak dapat mengunggah gambar. Pastikan bucket storage aktif.',

    // Alert: profile name empty
    alertProfileNameEmpty: 'Nama profil tidak boleh kosong.',

    // Alert: category empty
    alertCategoryEmpty: 'Kategori transaksi tidak boleh kosong.',

    // Alert: amount must be positive
    alertAmountPositive: 'Nominal harus lebih dari 0.',

    // Alert: delete budget failed
    alertDeleteBudgetFailed: 'Gagal menghapus batas anggaran.',

    // Alert: budget amount invalid
    alertBudgetAmountInvalid: 'Masukkan nominal anggaran yang valid (lebih dari 0).',

    // Alert: join input empty
    alertJoinInputEmpty: 'Tempel link atau kode undangan terlebih dahulu.',

    // Alert: join format invalid
    alertJoinFormatInvalid: 'Format link atau kode undangan tidak valid.',

    // Alert: sign out confirmation
    alertSignOutTitle: 'Keluar Akun',
    alertSignOutBody: 'Apakah kamu yakin ingin keluar?',
    btnSignOut: 'Keluar',

    // Alert: share login required
    alertLoginRequired: 'Login Diperlukan 🔐',
    alertLoginRequiredBody: 'Kamu harus masuk dengan akun Google terlebih dahulu sebelum dapat mengundang anggota ke dompet ini.',
    btnLoginNow: 'Masuk Sekarang',

    // Alert: daily reminder
    alertReminderActive: 'Aktif! 🔔',
    alertReminderBody: 'Pengingat harian dijadwalkan setiap jam 20:00.',

    // Alert: notification web
    alertNotifWebTitle: 'Info',
    alertNotifWebBody: 'Notifikasi lokal hanya tersedia di aplikasi Android & iOS.',

    // Alert: login failed (login screen)
    alertLoginFailed: 'Login Gagal',

    // Placeholder texts
    placeholderProfileName: 'Contoh: Budi Pratama',
    placeholderWalletName: 'Nama dompet baru',
    placeholderJoinWallet: 'https://dompet-bareng.vercel.app/invite/... atau kode token',
    placeholderTxNote: 'Keterangan transaksi...',

    // Offline banner
    offlineBanner: '⚡ Tidak ada koneksi internet',

    // Invite screen
    inviteCheckingLink: 'Memeriksa tautan undangan...',
    inviteCannotJoinTitle: 'Tidak Dapat Bergabung',
    inviteTokenNotFound: 'Token undangan tidak ditemukan.',
    inviteLinkInvalid: 'Tautan undangan tidak valid atau masa berlakunya sudah habis.',
    inviteWalletNotFound: 'Data dompet tidak ditemukan.',
    inviteLinkError: 'Terjadi kesalahan memuat tautan.',
    inviteTitle: 'Undangan Bergabung',
    inviteLeadDesc: 'Kamu diundang untuk mengelola keuangan bersama di dompet ini.',
    inviteAccountConnected: 'Akun Terhubung',
    inviteJoinAsBody: 'Kamu akan bergabung sebagai anggota menggunakan akun di atas.',
    inviteLoginRequired: 'Login Diperlukan',
    inviteLoginBody: 'Untuk bergabung dengan dompet bersama orang lain, kamu harus login dengan akun Google agar identitasmu terverifikasi dan transaksi tersinkronisasi.',
    inviteBtnOpenApp: '📱 Buka di Aplikasi',
    inviteDividerText: 'atau gunakan browser',
    inviteBtnJoinBrowser: 'Gabung via Browser',
    inviteBtnJoinGoogle: 'Masuk dengan Google (Browser)',
    inviteBtnJoin: 'Gabung ke Dompet Ini',
    inviteBtnSignInGoogle: 'Masuk dengan Google',
    inviteBackToHome: 'Kembali ke Beranda',
    alertInviteJoinFailed: 'Tidak dapat bergabung. Pastikan kamu memiliki izin atau tautan belum kedaluwarsa.',
    alertGoogleLoginFailed: 'Terjadi kesalahan saat login Google.',

    // Screen title in header
    screenTitleJoinWorkspace: 'Gabung Workspace',

    // OTA update modal texts
    otaChecking: 'Memeriksa Update...',
    otaDownloading: 'Mengunduh Update...',
    otaDownloadingBody: 'Update ditemukan dan sedang diunduh. Aplikasi akan restart otomatis.',
    otaCheckingBody: 'Menghubungi server Expo untuk memeriksa versi terbaru...',
    otaTitleUpdated: 'Update Berhasil!',
    otaTitleNoUpdate: 'Sudah Versi Terbaru',
    otaTitleInfo: 'Info',
    otaTitleError: 'Gagal Memeriksa Update',

    // Mascot overlay UI
    mascotLoading: 'Otter sedang memikirkan dompetmu...',
    mascotQuickAsk: 'TANYA CEPAT',
    mascotLastPrompt: 'Pertanyaan kamu:',
    mascotQuickNote: '⚡ Catat Cepat',
    mascotCategoryAmount: 'Kategori / Nominal:',
    mascotAddToForm: '＋ Masukkan ke Form Transaksi',
    mascotTxDetected: 'Transaksi terdeteksi!',
    mascotPressToSave: 'Tekan tombol di bawah untuk simpan ya!',
    mascotAiChecking: 'Mengecek koneksi Otter AI (maks 15 detik)...',
    mascotAiOffline: 'Otter Finansial AI sedang maintenance',
    mascotAiOfflineSub: 'Tenang, aku tetap bisa analisis dompetmu pakai chip di atas!',
    mascotRetryCheck: '🔄 Cek',
    mascotInputPlaceholder: 'Ketik transaksi / tanya keuangan...',
    mascotAccessLabel: 'Buka asisten keuangan Otter Finansial',

    // Login screen subtitle
    loginSubtitle: 'Manajemen keuangan bersama\nuntuk keluarga & organisasi',
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
    delete: 'Delete',
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
    editBudgetTitle: 'Edit Budget Limit',
    editBudgetSubtitle: 'Change category or monthly spending limit:',
    deleteBudgetConfirm: 'Delete budget limit for this category?',
    deleteBudgetBtn: 'Delete This Budget',
    editBudget: 'Edit',
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
    checkUpdate: 'Check for Updates',
    checkUpdateDesc: 'Check & apply the latest app update (OTA)',
    checkUpdateBtn: 'Check',
    updateChecking: 'Checking...',
    updateAvailable: 'Update found! Downloading...',
    updateNone: 'App is up to date.',
    updateApplied: 'Update applied!',
    updateNotSupported: 'OTA not active in this mode.',
    updateError: 'Failed to check for update.',
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

    // Edit & Detail Transaksi
    editTransaction: 'Edit Transaction',
    editTransactionSubtitle: 'Update date or category of this transaction',
    transactionDate: 'Transaction Date',
    transactionCategory: 'Transaction Category',
    editedTag: 'edited',
    lastEditedAt: 'Last Edited',
    deleteTransactionConfirm: 'Are you sure you want to delete this transaction? This action cannot be undone.',
    deleteTransactionSuccess: 'Transaction deleted successfully.',
    deleteTransactionFailed: 'Failed to delete transaction from server.',
    updateTransactionSuccess: 'Transaction changes saved successfully.',
    updateTransactionFailed: 'Failed to save transaction changes.',
    deleteTransactionBtn: 'Delete This Transaction',
    quickToday: 'Today',
    quickYesterday: 'Yesterday',
    dateFormatHint: 'Format: YYYY-MM-DD (e.g., 2026-09-18)',

    // Alert Dialogs
    alertSuccess: 'Success',
    alertFailed: 'Failed',
    alertError: 'Error',
    alertDeleteWallet: 'Delete Wallet?',
    alertDeleteWalletBody: 'All transaction data in this wallet will be permanently deleted.',
    alertDeleteWalletBtn: 'Delete Wallet',
    alertDeleteWalletFailed: 'Failed to delete wallet. Only the wallet creator can delete it.',
    alertLeaveWallet: 'Leave Wallet?',
    alertLeaveWalletBody: 'You will no longer be able to access this transaction history.',
    alertLeaveWalletBtn: 'Leave Wallet',
    alertLeaveWalletFailed: 'Failed to leave wallet.',
    alertProfileUpdated: 'Profile name updated successfully.',
    alertProfileUpdateFailed: 'Failed to update profile name.',
    alertPermissionRequired: 'Permission Required',
    alertGalleryPermission: 'Grant gallery access to change wallet photo.',
    alertKickSuccess: 'Member has been removed and notified.',
    alertKickFailed: 'Failed to remove member. Ensure you have admin privileges.',
    alertSystemError: 'A system error occurred.',
    alertReceiptUploadFailed: 'Receipt Upload Failed',
    alertReceiptUploadBody: 'Failed to upload receipt image. Save transaction without receipt?',
    alertReceiptSaveWithout: 'Save Without Receipt',
    alertTxSaveFailed: 'Failed to save transaction. Please try again.',
    alertAmountInvalid: 'Please enter a valid amount.',
    alertAttention: 'Attention',

    // Budget health badges
    budgetHealthy: 'Healthy',
    budgetWarning: 'Caution',
    budgetCritical: 'Critical',

    // Budget overbudget label
    budgetOverbudget: 'Overbudget',
    labelBudgetAmount: 'Category Budget Limit',

    // Transaction detail labels
    labelRecordedAt: 'Recorded At',
    labelNote: 'Note',
    labelRecordedBy: 'Recorded by',
    labelAmount: 'Amount',
    labelReceiptPhoto: 'Receipt / Bill Photo',
    labelTapZoom: 'Tap to enlarge',
    labelTapClose: 'Tap to close',
    labelAmountRp: 'Amount (Rp)',
    labelMemberSuffix: '(You)',

    // Transaction detail header
    detailTransactionTitle: 'Transaction Details',

    // Alert: create wallet failed
    alertCreateWalletFailed: 'Failed to create wallet. Please try again.',

    // Alert: cannot change wallet name
    alertRenameWalletFailed: 'Failed to rename wallet.',

    // Alert: cannot upload workspace image
    alertUploadImageFailed: 'Failed to upload image. Ensure storage bucket is active.',

    // Alert: profile name empty
    alertProfileNameEmpty: 'Profile name cannot be empty.',

    // Alert: category empty
    alertCategoryEmpty: 'Transaction category cannot be empty.',

    // Alert: amount must be positive
    alertAmountPositive: 'Amount must be greater than 0.',

    // Alert: delete budget failed
    alertDeleteBudgetFailed: 'Failed to delete budget limit.',

    // Alert: budget amount invalid
    alertBudgetAmountInvalid: 'Please enter a valid budget amount (greater than 0).',

    // Alert: join input empty
    alertJoinInputEmpty: 'Please paste an invite link or token code first.',

    // Alert: join format invalid
    alertJoinFormatInvalid: 'Invalid invite link or token format.',

    // Alert: sign out confirmation
    alertSignOutTitle: 'Sign Out',
    alertSignOutBody: 'Are you sure you want to sign out?',
    btnSignOut: 'Sign Out',

    // Alert: share login required
    alertLoginRequired: 'Login Required 🔐',
    alertLoginRequiredBody: 'You must sign in with a Google account before you can invite members to this wallet.',
    btnLoginNow: 'Sign In Now',

    // Alert: daily reminder
    alertReminderActive: 'Active! 🔔',
    alertReminderBody: 'Daily reminder scheduled every day at 20:00.',

    // Alert: notification web
    alertNotifWebTitle: 'Info',
    alertNotifWebBody: 'Local notifications are only available on Android & iOS apps.',

    // Alert: login failed (login screen)
    alertLoginFailed: 'Sign In Failed',

    // Placeholder texts
    placeholderProfileName: 'e.g., Alex Johnson',
    placeholderWalletName: 'New wallet name',
    placeholderJoinWallet: 'https://dompet-bareng.vercel.app/invite/... or token code',
    placeholderTxNote: 'Transaction description...',

    // Offline banner
    offlineBanner: '⚡ No internet connection',

    // Invite screen
    inviteCheckingLink: 'Checking invite link...',
    inviteCannotJoinTitle: 'Unable to Join',
    inviteTokenNotFound: 'Invite token not found.',
    inviteLinkInvalid: 'Invite link is invalid or has expired.',
    inviteWalletNotFound: 'Wallet data not found.',
    inviteLinkError: 'An error occurred loading the invite link.',
    inviteTitle: 'Join Invitation',
    inviteLeadDesc: 'You have been invited to manage finances together in this wallet.',
    inviteAccountConnected: 'Account Connected',
    inviteJoinAsBody: 'You will join as a member using the account above.',
    inviteLoginRequired: 'Sign In Required',
    inviteLoginBody: 'To join a shared wallet with others, sign in with your Google account so your identity is verified and transactions sync.',
    inviteBtnOpenApp: '📱 Open in App',
    inviteDividerText: 'or use browser',
    inviteBtnJoinBrowser: 'Join via Browser',
    inviteBtnJoinGoogle: 'Sign In with Google (Browser)',
    inviteBtnJoin: 'Join This Wallet',
    inviteBtnSignInGoogle: 'Sign In with Google',
    inviteBackToHome: 'Back to Home',
    alertInviteJoinFailed: 'Unable to join. Ensure you have permission or the link has not expired.',
    alertGoogleLoginFailed: 'An error occurred while signing in with Google.',

    // Screen title in header
    screenTitleJoinWorkspace: 'Join Workspace',

    // OTA update modal texts
    otaChecking: 'Checking for Updates...',
    otaDownloading: 'Downloading Update...',
    otaDownloadingBody: 'Update found and downloading. App will restart automatically.',
    otaCheckingBody: 'Connecting to Expo server to check for latest version...',
    otaTitleUpdated: 'Update Succeeded!',
    otaTitleNoUpdate: 'Already Up to Date',
    otaTitleInfo: 'Info',
    otaTitleError: 'Failed to Check for Updates',

    // Mascot overlay UI
    mascotLoading: 'Otter is analyzing your wallet...',
    mascotQuickAsk: 'QUICK ASK',
    mascotLastPrompt: 'Your question:',
    mascotQuickNote: '⚡ Quick Record',
    mascotCategoryAmount: 'Category / Amount:',
    mascotAddToForm: '＋ Add to Transaction Form',
    mascotTxDetected: 'Transaction detected!',
    mascotPressToSave: 'Press the button below to save!',
    mascotAiChecking: 'Checking Otter AI connection (up to 15s)...',
    mascotAiOffline: 'Otter Financial AI is in maintenance',
    mascotAiOfflineSub: "Don't worry, I can still analyze your wallet using the chips above!",
    mascotRetryCheck: '🔄 Check',
    mascotInputPlaceholder: 'Type transaction / ask about finances...',
    mascotAccessLabel: 'Open Otter Financial assistant',

    // Login screen subtitle
    loginSubtitle: 'Shared financial management\nfor family & organizations',
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
