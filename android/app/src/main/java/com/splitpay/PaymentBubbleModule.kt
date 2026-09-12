package com.splitpay

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.interfaces.fabric.ReactSurface

/**
 * Manages the floating bubble overlay. When a payment is detected (and the
 * user granted SYSTEM_ALERT_WINDOW permission) it creates a system overlay
 * window that hosts a second React surface rendering the "SplitPayBubble"
 * component — the same deterministic split flow, delivered over any app.
 *
 * Dragging is handled by a dedicated handle bar at the top of the window so
 * touches inside the React content keep working normally.
 */
class PaymentBubbleModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var surface: ReactSurface? = null
  private var container: FrameLayout? = null
  private var layoutParams: WindowManager.LayoutParams? = null

  override fun getName(): String = "PaymentBubble"

  override fun invalidate() {
    teardown()
    super.invalidate()
  }

  @ReactMethod
  fun isOverlayPermissionGranted(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
  }

  @ReactMethod
  fun openOverlayPermissionSettings() {
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${reactApplicationContext.packageName}")
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(intent)
  }

  @ReactMethod
  fun showBubble(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        if (!Settings.canDrawOverlays(reactApplicationContext)) {
          promise.resolve(false)
          return@runOnUiThread
        }
        ensureWindow()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("BUBBLE_ERROR", e)
      }
    }
  }

  @ReactMethod
  fun hideBubble(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        teardown()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("BUBBLE_ERROR", e)
      }
    }
  }

  /** Starts the Android share sheet without requiring a foreground Activity. */
  @ReactMethod
  fun shareText(message: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "text/plain"
      putExtra(Intent.EXTRA_TEXT, message)
    }
    val chooser = Intent.createChooser(send, "Compartir solicitud de pago")
    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactApplicationContext.startActivity(chooser)
  }

  private fun ensureWindow() {
    if (container != null) return

    val appContext = reactApplicationContext.applicationContext
    val reactHost = (appContext as? ReactApplication)?.reactHost ?: return

    val rootContainer = FrameLayout(appContext).apply {
      layoutParams = FrameLayout.LayoutParams(dp(320), dp(500))
      setBackgroundColor(0xE0000000.toInt())
    }

    // Drag handle bar at the top. Touching it moves the whole overlay window;
    // the React surface below stays fully interactive.
    val handle = View(appContext)
    val handleDp = dp(28)
    handle.setOnTouchListener(
      createDragTouchListener(rootContainer),
    )

    val surfaceHost = FrameLayout(appContext)

    val bubbleView = LinearLayout(appContext).apply {
      orientation = LinearLayout.VERTICAL
      addView(handle, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, handleDp))
      addView(
        surfaceHost,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f),
      )
    }
    rootContainer.addView(
      bubbleView,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )

    // Create the second React surface attached to the already-running host.
    val newSurface = reactHost.createSurface(appContext, "SplitPayBubble", null)
    val surfaceView = newSurface.view
      ?: run {
        return
      }
    surfaceHost.addView(
      surfaceView,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    surface = newSurface
    newSurface.start()

    val params = WindowManager.LayoutParams(
      dp(320),
      dp(500),
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.END
      x = 0
      y = dp(120)
    }

    val wm = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    wm.addView(rootContainer, params)
    layoutParams = params
    container = rootContainer
  }

  private fun teardown() {
    if (container == null) return
    val wm = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    try {
      wm.removeView(container)
    } catch (_: Exception) {
      // view already removed
    }
    surface?.stop()
    container = null
    surface = null
    layoutParams = null
  }

  /** Drag the overlay by updating its window layout position on move. */
  private fun createDragTouchListener(target: View): View.OnTouchListener {
    return object : View.OnTouchListener {
      private var startX = 0f
      private var startY = 0f
      private var startRawX = 0f
      private var startRawY = 0f
      private var dragging = false

      override fun onTouch(view: View, event: MotionEvent): Boolean {
        val params = layoutParams ?: return false
        val wm = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager

        return when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> {
            startX = params.x.toFloat()
            startY = params.y.toFloat()
            startRawX = event.rawX
            startRawY = event.rawY
            dragging = true
            view.parent?.requestDisallowInterceptTouchEvent(true)
            true
          }

          MotionEvent.ACTION_MOVE -> {
            if (!dragging) return false
            params.x = (startX + (event.rawX - startRawX)).toInt()
            params.y = (startY + (event.rawY - startRawY)).toInt()
            try {
              wm.updateViewLayout(target, params)
            } catch (_: Exception) {
              // window gone mid-drag
            }
            true
          }

          MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            dragging = false
            true
          }

          else -> false
        }
      }
    }
  }

  private fun dp(value: Int): Int {
    val density = reactApplicationContext.resources.displayMetrics.density
    return (value * density).toInt()
  }
}