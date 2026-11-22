package com.soldersight.glasses

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket

/**
 * A tiny HTTP server so a laptop on the same Wi-Fi can control the app:
 *
 *   curl http://<glasses-ip>:8080/open
 *   curl http://<glasses-ip>:8080/close
 *   curl http://<glasses-ip>:8080/ping
 *   curl "http://<glasses-ip>:8080/config?base=http://<mac-ip>:8001&board=00041003&lane=baseline"
 *   curl -X POST http://<glasses-ip>:8080/gate \
 *     -d '{"action":"BLOCK","reason":"open defects — do not ship"}'
 *
 * Anyone on the same network can reach it. /gate lands the demo closer on
 * the lens instantly, without waiting for stream pacing.
 */
class ControlServer(private val context: Context, private val port: Int) : Thread("ControlServer") {

    @Volatile private var serverSocket: ServerSocket? = null

    override fun run() {
        try {
            val server = ServerSocket().apply {
                reuseAddress = true
                bind(InetSocketAddress(port))
            }
            serverSocket = server
            Log.i(Config.TAG, "Control server listening on port $port")
            while (!isInterrupted) {
                server.accept().use { handle(it) }
            }
        } catch (e: IOException) {
            Log.i(Config.TAG, "Control server stopped: ${e.message}")
        }
    }

    private fun route(method: String, path: String, query: String, body: String): Pair<Int, String> =
        when {
            method == "GET" && path == "/open" -> {
                AppLauncher.open(context, "wifi")
                200 to """{"ok":true}"""
            }
            method == "GET" && path == "/close" -> {
                AppLauncher.close()
                200 to """{"ok":true}"""
            }
            method == "GET" && path == "/config" -> {
                val base = queryParam(query, "base")
                val board = queryParam(query, "board")
                val lane = queryParam(query, "lane") ?: "adapted"
                if (base == null || board == null) {
                    400 to """{"ok":false,"error":"missing base or board param"}"""
                } else {
                    MainActivity.configure(context, base, board, lane)
                    AppLauncher.open(context, "config")
                    200 to """{"ok":true,"base":"$base","board":"$board","lane":"$lane"}"""
                }
            }
            method == "POST" && path == "/gate" -> {
                try {
                    val gate = JSONObject(body)
                    if (MainActivity.isVisible) {
                        MainActivity.current?.get()?.showGateJson(gate)
                    } else {
                        MainActivity.pendingGate = gate
                        AppLauncher.open(context, "gate")
                    }
                    200 to """{"ok":true}"""
                } catch (e: Exception) {
                    400 to """{"ok":false,"error":"bad gate json"}"""
                }
            }
            method == "GET" && (path == "/" || path == "/ping") ->
                200 to """{"ok":true,"app":"${context.packageName}","visible":${MainActivity.isVisible}}"""
            else -> 404 to """{"ok":false,"error":"unknown path"}"""
        }

    private fun queryParam(query: String, name: String): String? =
        query.split('&').firstNotNullOfOrNull { pair ->
            val (k, v) = pair.split('=', limit = 2).let {
                it[0] to it.getOrElse(1) { "" }
            }
            if (k == name) v else null
        }

    private fun handle(client: Socket) {
        try {
            client.soTimeout = 5000
            val input = client.getInputStream()

            // Read headers byte-wise until \r\n\r\n so the body isn't consumed early.
            val head = ByteArrayOutputStream()
            var match = 0
            while (match < 4 && head.size() < 16 * 1024) {
                val b = input.read()
                if (b < 0) return
                head.write(b)
                match = when {
                    b == CRLF[match].toInt() -> match + 1
                    b == '\r'.code -> 1
                    else -> 0
                }
            }
            val lines = head.toString().split("\r\n")
            val parts = lines[0].split(" ")
            val method = parts.getOrNull(0) ?: "GET"
            val target = parts.getOrNull(1) ?: "/"
            val path = target.substringBefore('?')
            val query = target.substringAfter('?', "")
            val contentLength = lines.firstOrNull {
                it.startsWith("Content-Length:", ignoreCase = true)
            }?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0

            val body = if (method == "POST" && contentLength in 1..64 * 1024) {
                val buf = ByteArray(contentLength)
                var read = 0
                while (read < contentLength) {
                    val n = input.read(buf, read, contentLength - read)
                    if (n < 0) break
                    read += n
                }
                String(buf, 0, read)
            } else ""

            val (status, respBody) = route(method, path, query, body)
            val bytes = respBody.toByteArray()
            val reason = when (status) {
                200 -> "OK"; 400 -> "Bad Request"; else -> "Not Found"
            }
            val header = "HTTP/1.1 $status $reason\r\n" +
                "Content-Type: application/json\r\n" +
                "Content-Length: ${bytes.size}\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n"
            client.getOutputStream().apply {
                write(header.toByteArray())
                write(bytes)
                flush()
            }
        } catch (e: IOException) {
            Log.w(Config.TAG, "Control request failed: ${e.message}")
        }
    }

    fun shutdown() {
        interrupt()
        serverSocket?.close()
    }

    companion object {
        private val CRLF = byteArrayOf(13, 10, 13, 10)
    }
}
