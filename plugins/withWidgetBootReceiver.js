/**
 * plugins/withWidgetBootReceiver.js
 *
 * Plugin config Expo (CNG) yang menambahkan intent-filter BOOT_COMPLETED ke
 * receiver widget.
 *
 * Masalah yang dipecahkan:
 *   Plugin resmi react-native-android-widget hanya mendaftarkan
 *   APPWIDGET_UPDATE dan WIDGET_CLICK. Receiver tidak pernah menerima
 *   BOOT_COMPLETED, jadi setelah HP dinyalakan ulang widget tidak pernah
 *   di-trigger — penggunanya harus membuka aplikasi lebih dulu supaya widget
 *   terisi. Widget jadi tampak "kosong" setelah restart.
 *
 * Receiver widget diperluas di sini untuk menangkap action
 * android.intent.action.BOOT_COMPLETED dan MY_PACKAGE_REPLACED. Keduanya
 * diteruskan ke onUpdate milik AppWidgetProvider, yang berarti WorkManager
 * menjalankan widgetTaskHandler — jalur yang sama dengan update berkala.
 *
 * Permission RECEIVE_BOOT_COMPLETED ditambahkan supaya intent boot benar-benar
 * sampai ke aplikasi.
 *
 * CATATAN URUTAN MOD:
 *   Mod plugin dijalankan dalam urutan terbalik dari daftar plugins di app.json.
 *   Plugin ini terdaftar SESUDAH react-native-android-widget, jadi ia dieksekusi
 *   lebih dulu — saat itu receiver widget belum ada di modResults. Karena itu
 *   receiver tidak bisa diubah langsung di dalam aksi mod.
 *
 *   Solusinya: aksi mod tidak menyentuh receiver. Ia hanya menambah permission,
 *   lalu memanggil nextMod — yaitu mod milik plugin widget — dan baru setelah
 *   itu menyuntikkan boot action ke receiver yang barusan dibuat plugin itu.
 */

const fs = require('fs');
const path = require('path');

const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const BOOT_ACTIONS = [
  'android.intent.action.BOOT_COMPLETED',
  'android.intent.action.MY_PACKAGE_REPLACED',
];

const RECEIVE_BOOT_PERMISSION = 'android.permission.RECEIVE_BOOT_COMPLETED';

/**
 * Nama receiver widget: <package>.widget.<NamaWidget>, seperti yang dibuat
 * plugin react-native-android-widget.
 */
function isWidgetReceiverName(name) {
  if (!name) return false;
  if (name.startsWith('com.reactnativeandroidwidget.RNWidgetProvider')) return true;
  return name.startsWith('.widget.') || name.includes('.widget.');
}

function hasBootAction(receiver) {
  const filters = receiver['intent-filter'] ?? [];
  return filters.some((filter) =>
    (filter?.action ?? []).some((action) => BOOT_ACTIONS.includes(action?.$?.['android:name'])),
  );
}

module.exports = function withWidgetBootReceiver(config) {
  config = withAndroidManifest(config, async (androidManifestConfig) => {
    // modResults berbentuk { manifest: { $: {...}, ...anak } } — permission dan
    // application berada DI DALAM manifest, bukan di level modResults.
    const manifest = androidManifestConfig.modResults.manifest;

    // Permission <uses-permission> berada di level <manifest>, bukan <application>.
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    const alreadyRequested = manifest['uses-permission'].some(
      (permission) => permission?.$?.['android:name'] === RECEIVE_BOOT_PERMISSION,
    );
    if (!alreadyRequested) {
      manifest['uses-permission'].push({ $: { 'android:name': RECEIVE_BOOT_PERMISSION } });
    }

    // Mod berikutnya (plugin widget) dijalankan otomatis oleh framework SETELAH
    // aksi ini selesai — jadi receiver widget baru ada setelah aksi ini, bukan
    // sebelumnya. Karena itu suntikan boot action dilakukan pada aksi plugin
    // yang terdaftar SEBELUM plugin widget (lihat app.json).
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      androidManifestConfig.modResults,
    );
    const receivers = application.receiver ?? [];

    let patched = 0;
    for (const receiver of receivers) {
      const name = receiver?.$?.['android:name'];
      if (!isWidgetReceiverName(name) || hasBootAction(receiver)) continue;
      receiver['intent-filter'] = receiver['intent-filter'] ?? [];
      receiver['intent-filter'].push({
        action: BOOT_ACTIONS.map((actionName) => ({ $: { 'android:name': actionName } })),
      });
      patched += 1;
    }

    if (patched === 0) {
      console.warn(
        '[withWidgetBootReceiver] Belum ada receiver widget untuk disuntik — ' +
          'plugin ini harus terdaftar SEBELUM react-native-android-widget di app.json.',
      );
    } else {
      console.log(`[withWidgetBootReceiver] ${patched} receiver widget diberi BOOT_COMPLETED.`);
    }

    return androidManifestConfig;
  });

  // Receiver bawaan (extends RNWidgetProvider) mengabaikan intent BOOT_COMPLETED
  // karena AppWidgetProvider.onReceive() hanya memproses ACTION_APPWIDGET_UPDATE.
  // Jadi kelasnya diganti dengan subclass yang menangani boot secara eksplisit.
  //
  // Mod dangerous wajib karena menulis file .java ke android/app/src/main/java.
  config = withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const { platformProjectRoot, projectRoot } = dangerousConfig.modRequest;
      const packageName = dangerousConfig.android?.package;
      if (!platformProjectRoot || !packageName) return dangerousConfig;

      const widgetPackage = `${packageName}.widget`;
      const javaDir = path.join(
        platformProjectRoot,
        'app/src/main/java',
        widgetPackage.split('.').join('/'),
      );
      fs.mkdirSync(javaDir, { recursive: true });

      // 1. Tulis kelas base yang menangani boot.
      const baseSource = fs.readFileSync(
        path.join(projectRoot, 'plugins/java/BootAwareWidgetProvider.java'),
        'utf8',
      );
      fs.writeFileSync(
        path.join(javaDir, 'BootAwareWidgetProvider.java'),
        baseSource,
        'utf8',
      );

      // 2. Ganti isi tiap kelas widget agar extend BootAwareWidgetProvider.
      //    Plugin react-native-android-widget menulis kelas kosong
      //    "extends RNWidgetProvider" — kelas itu yang terdaftar di manifest.
      const widgetDir = path.join(javaDir);
      for (const fileName of fs.readdirSync(widgetDir)) {
        if (!fileName.endsWith('.java')) continue;
        if (fileName === 'BootAwareWidgetProvider.java') continue;
        const filePath = path.join(widgetDir, fileName);
        const source = fs.readFileSync(filePath, 'utf8');
        if (!source.includes('extends RNWidgetProvider')) continue;
        fs.writeFileSync(
          filePath,
          source
            .replace('extends RNWidgetProvider', 'extends BootAwareWidgetProvider')
            // Import RNWidgetProvider jadi tak terpakai setelah penggantian.
            .replace(/import com\.reactnativeandroidwidget\.RNWidgetProvider;\n/, ''),
          'utf8',
        );
      }

      return dangerousConfig;
    },
  ]);

  return config;
};
