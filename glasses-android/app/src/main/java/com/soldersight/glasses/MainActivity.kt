package com.soldersight.glasses

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.RectF
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import org.json.JSONObject
import java.io.BufferedReader
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL

/**
 * SolderSight — M6 worn overlay (docs/worn-m6-plan.md, rungs 3-4).
 *
 * Consumes the replay server's paced NDJSON stream — cells light up one
 * verdict at a time, then the board verdict, then the gate:
 *   GET {base}/glasses/stream/{board}?lane={lane}
 * falls back to the one-shot snapshot if the stream won't open:
 *   GET {base}/glasses/board/{board}?lane={lane}
 *
 * Target is set once via launch extras or over Wi-Fi, and persisted:
 *   adb shell am start -n com.soldersight.glasses/.MainActivity \
 *     --es base http://<mac-ip>:8001 --es board 00041003 --es lane baseline
 *   curl "http://<glasses-ip>:8080/config?base=…&board=…&lane=…"
 *
 * Rendering mirrors glasses/index.html: hairline cells on black (black is
 * see-through on the waveguide), verdict colours, one-line gate banner.
 *
 * Zero dependencies — org.json + HttpURLConnection + a custom View.
 */
class MainActivity : Activity() {

    companion object {
        const val EXTRA_REASON = "reason"
        private const val PREFS = "soldersight_glasses"

        @Volatile var isVisible = false
            private set
        @Volatile var current: WeakReference<MainActivity>? = null
            private set

        /** Gate event pushed while the overlay isn't on screen — rendered in onResume. */
        @Volatile var pendingGate: JSONObject? = null

        /** Repoint the replay target over Wi-Fi (ControlServer /config). */
        fun configure(context: Context, base: String, board: String, lane: String) {
            context.getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString("base", base.trimEnd('/'))
                .putString("board", board)
                .putString("lane", lane)
                .apply()
            Log.i(Config.TAG, "Target set: $base board=$board lane=$lane")
            current?.get()?.apply {
                this.base = base.trimEnd('/')
                this.board = board
                this.lane = lane
                startStream()
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var overlay: OverlayView
    @Volatile private var base: String? = null
    @Volatile private var board: String? = null
    @Volatile private var lane: String = "adapted"
    @Volatile private var streamGen = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // Keep the background service running even if the app was started some other way.
        startForegroundService(Intent(this, KeepAliveService::class.java))

        overlay = OverlayView(this)
        setContentView(overlay)

        handleExtras()
        if (base == null || board == null) {
            overlay.statusLine = "SET TARGET — curl \"http://<glasses-ip>:8080/config?base=http://<mac-ip>:8001&board=00041003&lane=baseline\""
            overlay.invalidate()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleExtras()
    }

    override fun onResume() {
        super.onResume()
        isVisible = true
        current = WeakReference(this)
        pendingGate?.let {
            pendingGate = null
            showGate(it)
        }
    }

    override fun onPause() {
        isVisible = false
        super.onPause()
    }

    override fun onDestroy() {
        streamGen++ // strand any in-flight stream thread
        super.onDestroy()
    }

    /** Touchpad: swipes are DPAD_LEFT / DPAD_RIGHT, a tap is ENTER, a double-tap is F12. */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_F12) { // double-tap: back to the menu
            finish()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    /** Push path — ControlServer calls this with a gate event that arrived over Wi-Fi. */
    fun showGateJson(gate: JSONObject) {
        handler.post { showGate(gate) }
    }

    private fun showGate(gate: JSONObject) {
        overlay.gateAction = gate.optString("action", "")
        overlay.gateReason = gate.optString("reason", gate.optString("label", ""))
        overlay.invalidate()
    }

    private fun handleExtras() {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        intent?.getStringExtra("base")?.let { prefs.edit().putString("base", it.trimEnd('/')).apply() }
        intent?.getStringExtra("board")?.let { prefs.edit().putString("board", it).apply() }
        intent?.getStringExtra("lane")?.let { prefs.edit().putString("lane", it).apply() }
        base = prefs.getString("base", null)
        board = prefs.getString("board", null)
        lane = prefs.getString("lane", "adapted") ?: "adapted"
        if (base != null && board != null) startStream()
    }

    /** NDJSON replay — one event per line, server-paced (~0.7 s/region). */
    private fun startStream() {
        val gen = ++streamGen
        val url = "$base/glasses/stream/$board?lane=$lane"
        overlay.reset()
        overlay.statusLine = "stream → $board ($lane)"
        overlay.invalidate()
        Thread({
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 3000
                conn.readTimeout = 0 // paced stream — no read deadline
                if (conn.responseCode != 200) {
                    conn.disconnect()
                    fallbackSnapshot(gen)
                    return@Thread
                }
                val reader = conn.inputStream.bufferedReader()
                readEvents(reader, gen)
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(Config.TAG, "stream failed: ${e.message}")
                fallbackSnapshot(gen)
            }
        }, "glasses-stream").apply { isDaemon = true }.start()
    }

    private fun readEvents(reader: BufferedReader, gen: Int) {
        while (gen == streamGen) {
            val line = reader.readLine() ?: break
            if (line.isBlank()) continue
            try {
                val ev = JSONObject(line)
                handler.post {
                    when (ev.optString("event")) {
                        "board" -> onBoardEvent(ev)
                        "region" -> onRegionEvent(ev)
                        "verdict" -> onVerdictEvent(ev)
                        "gate" -> showGate(ev)
                    }
                }
            } catch (e: Exception) {
                Log.w(Config.TAG, "bad stream line: ${e.message}")
            }
        }
    }

    /** One-shot snapshot — same end state without the pacing. */
    private fun fallbackSnapshot(gen: Int) {
        try {
            val conn = URL("$base/glasses/board/$board?lane=$lane")
                .openConnection() as HttpURLConnection
            conn.connectTimeout = 2000
            conn.readTimeout = 3000
            if (conn.responseCode != 200) {
                conn.disconnect()
                handler.post {
                    if (gen == streamGen) {
                        overlay.statusLine = "no run for $lane:$board"
                        overlay.invalidate()
                    }
                }
                return
            }
            val payload = JSONObject(conn.inputStream.bufferedReader().readText())
            conn.disconnect()
            handler.post {
                if (gen != streamGen) return@post
                onBoardEvent(JSONObject().put("grid", payload.getJSONObject("grid"))
                    .put("image", payload.optString("image")))
                val regions = payload.getJSONArray("regions")
                for (i in 0 until regions.length()) onRegionEvent(regions.getJSONObject(i))
                onVerdictEvent(payload.getJSONObject("board"))
                showGate(payload.getJSONObject("board").getJSONObject("gate"))
            }
        } catch (e: Exception) {
            Log.w(Config.TAG, "snapshot failed: ${e.message}")
            handler.post {
                if (gen == streamGen) {
                    overlay.statusLine = "unreachable — $base"
                    overlay.invalidate()
                }
            }
        }
    }

    private fun onBoardEvent(ev: JSONObject) {
        val grid = ev.getJSONObject("grid")
        overlay.gridRows = grid.optInt("rows", 8)
        overlay.gridCols = grid.optInt("cols", 8)
        overlay.gridPx = grid.optInt("width", 640)
        overlay.statusLine = "inspecting…"
        overlay.invalidate()
        if (Config.SHOW_BOARD_IMAGE) {
            val img = ev.optString("image").substringAfterLast('/')
            if (img.isNotEmpty()) fetchImage(img)
        }
    }

    private fun onRegionEvent(ev: JSONObject) {
        overlay.regions[ev.optInt("cell")] = OverlayView.Region(
            bbox = ev.optJSONArray("bbox"),
            bboxPx = ev.optJSONArray("bbox_px"),
            verdict = ev.optString("verdict", "pass"),
            cell = ev.optInt("cell"),
        )
        overlay.statusLine = ev.optString("note", "")
        overlay.invalidate()
    }

    private fun onVerdictEvent(ev: JSONObject) {
        val disp = ev.optString("disposition", "").uppercase()
        val defect = ev.optString("defect_type", "")
        overlay.topline = if (defect.isNotEmpty() && defect != "none") "$disp — $defect" else disp
        overlay.statusLine = ev.optString("reason", "")
        overlay.invalidate()
    }

    private fun fetchImage(name: String) {
        val gen = streamGen
        Thread({
            try {
                val conn = URL("$base/images/$name").openConnection() as HttpURLConnection
                conn.connectTimeout = 3000
                conn.readTimeout = 5000
                val bmp = BitmapFactory.decodeStream(conn.inputStream)
                conn.disconnect()
                if (bmp != null) handler.post {
                    if (gen == streamGen) {
                        overlay.boardImage = bmp
                        overlay.invalidate()
                    }
                }
            } catch (e: Exception) {
                Log.w(Config.TAG, "image fetch failed: ${e.message}")
            }
        }, "glasses-image").apply { isDaemon = true }.start()
    }
}

/** The worn overlay: board grid + verdict cells + one-line gate. */
class OverlayView(context: Context) : View(context) {

    class Region(
        val bbox: org.json.JSONArray?,
        val bboxPx: org.json.JSONArray?,
        val verdict: String,
        val cell: Int,
    )

    var gridRows = 8
    var gridCols = 8
    var gridPx = 640
    var regions = LinkedHashMap<Int, Region>()
    var boardImage: android.graphics.Bitmap? = null
    var topline = "SOLDERSIGHT"
    var statusLine = ""
    var gateAction = ""
    var gateReason = ""

    fun reset() {
        regions.clear()
        boardImage = null
        topline = "SOLDERSIGHT"
        statusLine = ""
        gateAction = ""
        gateReason = ""
    }

    private val accent = Color.parseColor("#4ade80")
    private val accentDim = Color.argb(97, 74, 222, 128)
    private val warn = Color.parseColor("#fbbf24")
    private val bad = Color.parseColor("#f87171")
    private val ink = Color.parseColor("#d7f5e3")

    private val hairline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accentDim; style = Paint.Style.STROKE; strokeWidth = 1f
    }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ink; textSize = 22f; typeface = android.graphics.Typeface.MONOSPACE
    }
    private val tagText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK; textSize = 12f
        typeface = android.graphics.Typeface.create(
            android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD)
    }
    private val imgPaint = Paint().apply {
        alpha = 110
        colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
    }

    private fun verdictColor(v: String) = when (v) {
        "scrap" -> bad; "rework" -> warn; else -> accent
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.BLACK)
        val w = width.toFloat(); val h = height.toFloat()
        val pad = 12f

        // Board: square, left of centre — text column to its right.
        val side = (minOf(w, h) - 2 * pad) * 0.92f
        val board = RectF(pad, (h - side) / 2, pad + side, (h - side) / 2 + side)
        canvas.drawRect(board, hairline)

        boardImage?.let { canvas.drawBitmap(it, null, board, imgPaint) }

        // Pending grid, then verdict cells.
        val cw = board.width() / gridCols
        val ch = board.height() / gridRows
        for (r in 0 until gridRows) for (c in 0 until gridCols) {
            canvas.drawRect(
                board.left + c * cw, board.top + r * ch,
                board.left + (c + 1) * cw, board.top + (r + 1) * ch, hairline)
        }
        for (region in regions.values) {
            val cell = cellRect(region, board) ?: continue
            val p = Paint(hairline).apply {
                color = verdictColor(region.verdict); strokeWidth = 3f
            }
            canvas.drawRect(cell, p)
            // Verdict tag, top-left of the cell.
            val tag = Paint(p).apply { style = Paint.Style.FILL }
            canvas.drawRect(cell.left, cell.top, cell.left + 22f, cell.top + 16f, tag)
            canvas.drawText(region.cell.toString(), cell.left + 3f, cell.top + 13f, tagText)
        }

        // Text column.
        val tx = board.right + 24f
        val ty = board.top + 26f
        text.color = accent; text.textSize = 24f
        canvas.drawText(topline, tx, ty, text)
        text.color = ink; text.textSize = 18f
        var y = ty + 34f
        // Verdict rows, most recent last — wrap-free, clip to the column.
        val colW = w - tx - pad
        for (region in regions.values.toList().takeLast(8)) {
            val v = region.verdict.uppercase()
            text.color = verdictColor(region.verdict)
            canvas.drawText("${region.cell} $v", tx, y, text)
            y += 24f
        }

        // Status line across the bottom; gate banner above it.
        text.textSize = 18f
        val statusY = h - pad - 34f
        if (gateAction.isNotEmpty()) {
            val g = Paint(text).apply {
                color = verdictColor(
                    if (gateAction == "BLOCK") "scrap" else if (gateAction == "REVIEW") "rework" else "pass")
                textSize = 30f
            }
            canvas.drawText("$gateAction — $gateReason", pad, statusY - 40f, g)
        }
        text.color = ink
        canvas.drawText(statusLine.take(80), pad, statusY, text)
        text.color = accentDim; text.textSize = 14f
        canvas.drawText("SOLDERSIGHT", pad, h - pad, text)
    }

    private fun cellRect(region: Region, board: RectF): RectF? {
        val b = region.bboxPx
        if (b != null && b.length() >= 4) {
            val s = board.width() / gridPx
            return RectF(
                board.left + b.getDouble(0).toFloat() * s,
                board.top + b.getDouble(1).toFloat() * s,
                board.left + (b.getDouble(0) + b.getDouble(2)).toFloat() * s,
                board.top + (b.getDouble(1) + b.getDouble(3)).toFloat() * s)
        }
        val rel = region.bbox
        if (rel != null && rel.length() >= 4) {
            return RectF(
                board.left + rel.getDouble(0).toFloat() * board.width(),
                board.top + rel.getDouble(1).toFloat() * board.height(),
                board.left + (rel.getDouble(0) + rel.getDouble(2)).toFloat() * board.width(),
                board.top + (rel.getDouble(1) + rel.getDouble(3)).toFloat() * board.height())
        }
        // No bbox — index the cell into the grid.
        val idx = region.cell
        val cw = board.width() / gridCols
        val ch = board.height() / gridRows
        val r = idx / gridCols; val c = idx % gridCols
        return RectF(board.left + c * cw, board.top + r * ch,
            board.left + (c + 1) * cw, board.top + (r + 1) * ch)
    }
}
