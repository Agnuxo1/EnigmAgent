package com.enigmagent.vault.client

import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class VaultStatus(val running: Boolean, val unlocked: Boolean, val message: String)
data class VaultEntry(val id: String, val name: String, val domain: String?)
data class VaultError(val code: String, override val message: String) : Exception(message)

/**
 * Lightweight HTTP client for the EnigmAgent local REST API.
 * Uses only stdlib — no external HTTP library required.
 */
class VaultClient(private val host: String = "127.0.0.1", private val port: Int = 3737) {

    private val gson = Gson()
    private val baseUrl get() = "http://$host:$port"

    // ── Internal helpers ──────────────────────────────────────────────────

    private fun get(path: String): JsonObject {
        val conn = URL("$baseUrl$path").openConnection() as HttpURLConnection
        conn.connectTimeout = 3_000
        conn.readTimeout    = 5_000
        return try {
            conn.connect()
            if (conn.responseCode != 200) {
                val body = conn.errorStream?.bufferedReader()?.readText() ?: "{}"
                val err  = gson.fromJson(body, JsonObject::class.java)
                throw VaultError(
                    err.get("error")?.asString ?: "http_error",
                    err.get("message")?.asString ?: "HTTP ${conn.responseCode}"
                )
            }
            gson.fromJson(conn.inputStream.bufferedReader().readText(), JsonObject::class.java)
        } catch (e: VaultError) {
            throw e
        } catch (e: Exception) {
            throw VaultError("server_unreachable",
                "EnigmAgent vault unreachable at $baseUrl — start with: enigmagent-mcp --mode rest --port $port")
        } finally {
            conn.disconnect()
        }
    }

    private fun post(path: String, payload: Map<String, String>): JsonObject {
        val conn = URL("$baseUrl$path").openConnection() as HttpURLConnection
        conn.requestMethod  = "POST"
        conn.doOutput       = true
        conn.connectTimeout = 3_000
        conn.readTimeout    = 5_000
        conn.setRequestProperty("Content-Type", "application/json")
        return try {
            conn.connect()
            OutputStreamWriter(conn.outputStream).use { it.write(gson.toJson(payload)) }
            if (conn.responseCode != 200) {
                val body = conn.errorStream?.bufferedReader()?.readText() ?: "{}"
                val err  = gson.fromJson(body, JsonObject::class.java)
                throw VaultError(
                    err.get("error")?.asString ?: "http_error",
                    err.get("message")?.asString ?: "HTTP ${conn.responseCode}"
                )
            }
            gson.fromJson(conn.inputStream.bufferedReader().readText(), JsonObject::class.java)
        } catch (e: VaultError) {
            throw e
        } catch (e: Exception) {
            throw VaultError("server_unreachable", "EnigmAgent vault unreachable at $baseUrl")
        } finally {
            conn.disconnect()
        }
    }

    // ── Public API ────────────────────────────────────────────────────────

    fun getStatus(): VaultStatus {
        return try {
            val data = get("/status")
            val unlocked = data.get("unlocked")?.asBoolean ?: false
            VaultStatus(
                running  = true,
                unlocked = unlocked,
                message  = if (unlocked) "Vault RUNNING and UNLOCKED"
                           else "Vault LOCKED — restart enigmagent-mcp"
            )
        } catch (e: VaultError) {
            VaultStatus(running = false, unlocked = false,
                message = "Server unreachable — start: enigmagent-mcp --mode rest --port $port")
        }
    }

    fun listSecrets(): List<VaultEntry> {
        val data    = get("/list")
        val entries = data.getAsJsonArray("entries") ?: return emptyList()
        return entries.map { el ->
            val obj = el.asJsonObject
            VaultEntry(
                id     = obj.get("id")?.asString ?: "",
                name   = obj.get("name")?.asString ?: "",
                domain = obj.get("domain")?.asString
            )
        }
    }

    fun resolve(placeholder: String, origin: String = "http://localhost"): String {
        val data = post("/resolve", mapOf("placeholder" to placeholder, "origin" to origin))
        return data.get("value")?.asString
            ?: throw VaultError("resolve_error", "No value returned for $placeholder")
    }
}
