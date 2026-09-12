package com.splitpay

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

private const val TAG = "SplitPay"

/**
 * Listens for notifications published by any app after the user grants
 * Notification Access. Forwards every notification to [PaymentEventBus] as a
 * raw [NotificationPayload]; the JS side decides whether it looks like a
 * payment.
 *
 * Requires being bound by the system with
 * BIND_NOTIFICATION_LISTENER_SERVICE (see AndroidManifest.xml).
 */
class PaymentNotificationListener : NotificationListenerService() {

  override fun onListenerConnected() {
    Log.d(TAG, "PaymentNotificationListener connected")
  }

  override fun onListenerDisconnected() {
    Log.w(TAG, "PaymentNotificationListener disconnected")
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val extras = sbn.notification?.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()

    val payload = NotificationPayload(
      packageName = sbn.packageName,
      title = title,
      text = text,
      timestamp = sbn.postTime,
    )
    PaymentEventBus.publish(payload)
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    // Not needed for the MVP.
  }
}