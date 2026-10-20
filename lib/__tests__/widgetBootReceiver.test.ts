import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Regression untuk "widget kosong setelah HP dinyalakan ulang".
 *
 * Dua hal harus benar agar widget terisi tanpa pengguna membuka aplikasi:
 *   1. Receiver widget harus menerima intent BOOT_COMPLETED. Plugin resmi
 *      react-native-android-widget hanya mendaftarkan APPWIDGET_UPDATE dan
 *      WIDGET_CLICK, jadi tanpa tambahan ini widget tak pernah ter-trigger
 *      setelah restart.
 *   2. Receiver bawaan (extends RNWidgetProvider) mengabaikan BOOT_COMPLETED,
 *      karena AppWidgetProvider.onReceive() hanya memproses
 *      ACTION_APPWIDGET_UPDATE. Karena itu receiver harus extends
 *      BootAwareWidgetProvider yang menangani boot secara eksplisit.
 */

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))
}

function readText(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

const { expo } = readJson('app.json')
const pluginSource = readText('plugins/withWidgetBootReceiver.js')
const providerSource = readText('plugins/java/BootAwareWidgetProvider.java')

describe('widget boot receiver configuration', () => {
  it('registers the boot receiver plugin before the widget plugin', () => {
    const plugins = expo.plugins as unknown[]
    const bootIndex = plugins.findIndex(
      (plugin) => plugin === './plugins/withWidgetBootReceiver',
    )
    const widgetIndex = plugins.findIndex(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-android-widget',
    )
    expect(bootIndex).toBeGreaterThanOrEqual(0)
    expect(widgetIndex).toBeGreaterThanOrEqual(0)
    // Mod plugin dieksekusi dalam urutan terbalik: plugin yang terdaftar lebih
    // awal justru jalan lebih akhir. Agar receiver widget sudah ada saat
    // suntikan boot, plugin boot harus terdaftar SEBELUM plugin widget.
    expect(bootIndex).toBeLessThan(widgetIndex)
  })

  it('adds BOOT_COMPLETED and MY_PACKAGE_REPLACED to every widget receiver', () => {
    expect(pluginSource).toContain('android.intent.action.BOOT_COMPLETED')
    expect(pluginSource).toContain('android.intent.action.MY_PACKAGE_REPLACED')
    expect(pluginSource).toContain('RECEIVE_BOOT_COMPLETED')
  })

  it('handles the boot intent explicitly in the provider', () => {
    expect(providerSource).toContain('Intent.ACTION_BOOT_COMPLETED')
    expect(providerSource).toContain('Intent.ACTION_MY_PACKAGE_REPLACED')
    //BOOT_COMPLETED harus memicu onUpdate supaya WorkManager menjalankan
    // widgetTaskHandler — itu yang menarik data terbaru.
    expect(providerSource).toContain('onUpdate(context, manager, widgetIds)')
    expect(providerSource).toContain('extends RNWidgetProvider')
  })

  it('rewrites the generated widget providers to extend the boot-aware base', () => {
    expect(pluginSource).toContain('extends BootAwareWidgetProvider')
    expect(pluginSource).toContain('BootAwareWidgetProvider.java')
  })
})
