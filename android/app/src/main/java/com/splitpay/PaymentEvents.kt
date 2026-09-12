package com.splitpay

import android.os.Bundle
import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

private const val TAG = "SplitPay"

/**
 * A raw notification observed on the device. This is the common event shape
 * produced both by [PaymentNotificationListener] (real notifications) and by
 * the simulate payment module method (demo). Forwarded to React Native as-is.
 */
data class NotificationPayload(
  val packageName: String,
  val title: String?,
  val text: String?,
  val timestamp: Long,
) {
  fun toBundle(): Bundle =
    Bundle().apply {
      putString("packageName", packageName)
      putString("title", title)
      putString("text", text)
      putLong("timestamp", timestamp)
    }
}

/**
 * Simple in-process bus that routes [NotificationPayload]s from the
 * NotificationListenerService (or the simulate method) to the React Native
 * bridge. Events are always stored so the JS side can pull them on mount, and
 * pushed live when a React context is registered.
 */
object PaymentEventBus {
  private val observers = CopyOnWriteArrayList<(NotificationPayload) -> Unit>()
  private val pending = java.util.concurrent.ConcurrentLinkedQueue<NotificationPayload>()

  fun addObserver(observer: (NotificationPayload) -> Unit): () -> Unit {
    observers.add(observer)
    return { observers.remove(observer) }
  }

  fun getPending(): List<NotificationPayload> = pending.toList()

  fun clearPending() {
    pending.clear()
  }

  fun publish(payload: NotificationPayload) {
    Log.d(
      TAG,
      "PAYMENT_NOTIFICATION package=" + payload.packageName +
        " title=" + payload.title +
        " text=" + payload.text,
    )
    pending.add(payload)
    observers.forEach { observer ->
      try {
        observer(payload)
      } catch (e: Throwable) {
        Log.w(TAG, "observer failed", e)
      }
    }
  }
}