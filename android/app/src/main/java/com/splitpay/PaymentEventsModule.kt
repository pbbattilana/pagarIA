package com.splitpay

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class PaymentEventsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val eventName = "PaymentEvent"
  private var unsubscribe: (() -> Unit)? = null

  override fun getName(): String = "PaymentEvents"

  override fun initialize() {
    super.initialize()
    // Route events published by the notification listener (or by simulate)
    // straight into React Native the moment the JS app is mounted.
    unsubscribe = PaymentEventBus.addObserver { payload -> sendEvent(payload) }
  }

  override fun invalidate() {
    unsubscribe?.invoke()
    unsubscribe = null
    super.invalidate()
  }

  private fun sendEvent(payload: NotificationPayload) {
    val reactApplicationContext = reactApplicationContext
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val map: WritableMap = Arguments.createMap().apply {
      putString("packageName", payload.packageName)
      putString("title", payload.title)
      putString("text", payload.text)
      putDouble("timestamp", payload.timestamp.toDouble())
    }
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, map)
  }

  // Contract required by react-native's NativeEventEmitter. Events are emitted
  // through the global RCTDeviceEventEmitter, so these are standard no-ops.
  @ReactMethod
  fun addListener(eventName: String) {
    // no-op
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // no-op
  }

  /** Returns any notifications captured before the JS app was mounted. */
  @ReactMethod
  fun getPendingPayments(callback: Callback) {
    val array = Arguments.createArray()
    PaymentEventBus.getPending().forEach { payload ->
      array.pushMap(Arguments.createMap().apply {
        putString("packageName", payload.packageName)
        putString("title", payload.title)
        putString("text", payload.text)
        putDouble("timestamp", payload.timestamp.toDouble())
      })
    }
    callback.invoke(array)
  }

  @ReactMethod
  fun clearPendingPayments() {
    PaymentEventBus.clearPending()
  }

  @ReactMethod
  fun hasNotificationAccess(callback: Callback) {
    val enabled = Settings.Secure
      .getString(reactApplicationContext.contentResolver, "enabled_notification_listeners")
      ?.contains(PaymentNotificationListener::class.java.name) == true
    callback.invoke(enabled)
  }

  @ReactMethod
  fun openNotificationAccessSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(intent)
  }

  /**
   * Demo path. Produces exactly the same [NotificationPayload] (and therefore
   * the same PaymentEvent in React Native) as a real notification detected by
   * [PaymentNotificationListener].
   */
  @ReactMethod
  fun simulatePayment(text: String) {
    val payload = NotificationPayload(
      packageName = "com.splitpay.demo",
      title = "Compra aprobada",
      text = text,
      timestamp = System.currentTimeMillis(),
    )
    PaymentEventBus.publish(payload)
  }

  companion object {
    fun createModule(reactContext: ReactApplicationContext): PaymentEventsModule =
      PaymentEventsModule(reactContext)
  }
}