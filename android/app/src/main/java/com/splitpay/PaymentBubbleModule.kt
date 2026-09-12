package com.splitpay

import android.content.Context
import android.content.Intent
import android.util.Base64
import android.util.Log
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
import android.widget.TextView
import androidx.core.content.FileProvider
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.interfaces.fabric.ReactSurface
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream

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
  private var closeButton: View? = null

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

  /**
   * Writes a base64-encoded PNG to the app cache and shares it as an image via
   * a content:// URI so other apps can read it (no legacy file:// sharing).
   */
  @ReactMethod
  fun shareImage(message: String, base64Png: String) {
    val appContext = reactApplicationContext.applicationContext
    val bytes = try {
      Base64.decode(base64Png, Base64.DEFAULT)
    } catch (_: IllegalArgumentException) {
      return
    }
    if (bytes.isEmpty()) return

    val dir = File(appContext.cacheDir, "shared").apply { mkdirs() }
    val file = File(dir, "splitpay_qr_${System.currentTimeMillis()}.png")
    try {
      FileOutputStream(file).use { it.write(bytes) }
    } catch (e: Exception) {
      return
    }

    val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "image/png"
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_TEXT, message)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, "Compartir QR de pago")
    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    appContext.startActivity(chooser)
  }

  /** Resizes the overlay window to fit the natural height of the bubble content. */
  @ReactMethod
  fun resizeBubble(heightDp: Int) {
    UiThreadUtil.runOnUiThread {
      val params = layoutParams ?: return@runOnUiThread
      val newHeight = dp(heightDp + BUBBLE_HANDLE_DP)
      if (params.height == newHeight) return@runOnUiThread
      params.height = newHeight
      try {
        val wm = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        wm.updateViewLayout(container, params)
      } catch (_: Exception) {
        // window gone mid-resize
      }
    }
  }

  private fun ensureWindow() {
    if (container != null) return

    val appContext = reactApplicationContext.applicationContext
    val reactHost = (appContext as? ReactApplication)?.reactHost ?: return

    val rootContainer = FrameLayout(appContext).apply {
      layoutParams = FrameLayout.LayoutParams(dp(BUBBLE_WIDTH_DP), dp(BUBBLE_HEIGHT_DP))
      // Fully transparent so only the rendered card is visible; the window
      // height is adjusted via resizeBubble() to hug the content.
      setBackgroundColor(0x00000000)
    }

    // Drag handle bar at the top, with a centered grab-pill and a close button.
    val handle = FrameLayout(appContext)
    val handleDp = dp(BUBBLE_HANDLE_DP)
    handle.setOnTouchListener(
      createDragTouchListener(rootContainer),
    )

    val pill = View(appContext).apply {
      background = android.graphics.drawable.GradientDrawable().apply {
        setColor(0x55FFFFFF.toInt())
        cornerRadius = dp(BUBBLE_PILL_HEIGHT_DP) / 2f
      }
      layoutParams = FrameLayout.LayoutParams(dp(BUBBLE_PILL_WIDTH_DP), dp(BUBBLE_PILL_HEIGHT_DP), Gravity.CENTER)
    }

    val close = TextView(appContext).apply {
      text = "✕"
      textSize = 14f
      setTextColor(0xFFFFFFFF.toInt())
      gravity = Gravity.CENTER
      layoutParams = FrameLayout.LayoutParams(dp(BUBBLE_CLOSE_SIZE_DP), handleDp, Gravity.END or Gravity.CENTER_VERTICAL)
    }
    close.setOnClickListener { closeBubble() }
    closeButton = close

    handle.addView(pill)
    handle.addView(close)

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

    val windowWidth = dp(BUBBLE_WIDTH_DP)
    val initialHeight = dp(BUBBLE_HEIGHT_DP)
    val statusBarTop = currentStatusBarHeight()
    val params = WindowManager.LayoutParams(
      windowWidth,
      initialHeight,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = screenWidth() - windowWidth - dp(BUBBLE_MARGIN_DP)
      // Start below the status bar so the drag handle stays fully touchable
      // instead of sitting under the system status- bar input region.
      y = statusBarTop + dp(BUBBLE_MARGIN_DP)
    }

    val wm = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    wm.addView(rootContainer, params)
    layoutParams = params
    container = rootContainer
  }

  /** Tears the window down and tells React Native to reset the flow. */
  private fun closeBubble() {
    Log.i(
      "SplitPayBubble",
      "closeBubble from: " +
        Throwable().stackTrace
          .take(6)
          .joinToString("\n") { "  at $it" },
    )
    try {
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("BubbleClose", Arguments.createMap())
    } catch (_: Exception) {
      // JS bridge not available
    }
    teardown()
  }

  private fun screenWidth(): Int =
    reactApplicationContext.resources.displayMetrics.widthPixels

  private fun screenHeight(): Int =
    reactApplicationContext.resources.displayMetrics.heightPixels

  /** Height of the system status bar in pixels, or 0 if not measurable. */
  private fun currentStatusBarHeight(): Int {
    return try {
      val resources = reactApplicationContext.resources
      val id = resources.getIdentifier(
        "status_bar_height",
        "dimen",
        "android",
      )
      if (id > 0) resources.getDimensionPixelSize(id) else 0
    } catch (_: Exception) {
      0
    }
  }

  private fun teardown() {
    if (container == null) return
    Log.i(
      "SplitPayBubble",
      "teardown called from: " +
        Throwable().stackTrace
          .take(8)
          .joinToString("\n") { "  at $it" },
    )
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
    closeButton = null
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
            // Let the close button handle touches that start inside it.
            val close = closeButton ?: return false
            val bounds = closeBoundsScreenX(close)
            Log.i("SplitPayBubble", "drag DOWN rawX=${event.rawX} close=[${bounds.first},${bounds.second}]")
            if (event.rawX >= bounds.first && event.rawX <= bounds.second) return false
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
            val maxX = screenWidth() - params.width
            val maxY = screenHeight() - params.height
            val nextX = (startX + (event.rawX - startRawX)).toInt().coerceIn(0, maxX.coerceAtLeast(0))
            val nextY = (startY + (event.rawY - startRawY)).toInt().coerceIn(0, maxY.coerceAtLeast(0))
            if (params.x == nextX && params.y == nextY) return true
            params.x = nextX
            params.y = nextY
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

  /** Returns the [start, end] horizontal range of the close button on screen. */
  private fun closeBoundsScreenX(close: View): Pair<Int, Int> {
    val location = IntArray(2)
    close.getLocationOnScreen(location)
    return location[0] to (location[0] + close.width)
  }

  private fun dp(value: Int): Int {
    val density = reactApplicationContext.resources.displayMetrics.density
    return (value * density).toInt()
  }

  private companion object {
    const val BUBBLE_WIDTH_DP = 320
    const val BUBBLE_HEIGHT_DP = 500
    const val BUBBLE_HANDLE_DP = 28
    const val BUBBLE_MARGIN_DP = 8
    const val BUBBLE_PILL_WIDTH_DP = 36
    const val BUBBLE_PILL_HEIGHT_DP = 4
    const val BUBBLE_CLOSE_SIZE_DP = 32
  }
}