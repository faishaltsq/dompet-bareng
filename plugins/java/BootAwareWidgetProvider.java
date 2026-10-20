package com.dompetbareng.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.reactnativeandroidwidget.RNWidgetProvider;

/**
 * Receiver widget yang juga merespons event boot / update aplikasi.
 *
 * AppWidgetProvider.onReceive() bawaan hanya memproses intent yang berawalan
 * ACTION_APPWIDGET_UPDATE. Intent BOOT_COMPLETED (dan MY_PACKAGE_REPLACED)
 * karena itu diabaikan, sehingga setelah HP dinyalakan ulang widget tidak
 * pernah di-trigger dan penggunanya harus membuka aplikasi lebih dulu supaya
 * widget terisi.
 *
 * Di sini intent boot ditangani eksplisit: semua id widget milik receiver ini
 * dikumpulkan, lalu onUpdate() dipanggil manual dengan aksi WIDGET_UPDATE.
 * onUpdate() milik RNWidgetProvider lalu menjadwalkan WorkManager yang
 * menjalankan widgetTaskHandler — jalur yang sama dengan update berkala,
 * sehingga widget menarik data terbaru sendiri tanpa aplikasi dibuka.
 */
public class BootAwareWidgetProvider extends RNWidgetProvider {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            updateAllWidgets(context);
            return;
        }

        super.onReceive(context, intent);
    }

    /**
     * Meminta update untuk setiap instance widget milik receiver ini.
     */
    private void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) {
            return;
        }

        ComponentName component = new ComponentName(context, getClass());
        int[] widgetIds = manager.getAppWidgetIds(component);
        if (widgetIds == null || widgetIds.length == 0) {
            return;
        }

        onUpdate(context, manager, widgetIds);
    }
}
