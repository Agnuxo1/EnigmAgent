package enigmagent.plugin;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Lightweight HTTP client for the EnigmAgent local REST API (stdlib only).
 */
public class VaultClient {

    private final String baseUrl;

    public VaultClient(String host, int port) {
        this.baseUrl = "http://" + host + ":" + port;
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Returns true if the vault is running and unlocked. */
    public boolean isUnlocked() {
        try {
            String body = get("/status");
            return body.contains("\"unlocked\":true");
        } catch (Exception e) {
            return false;
        }
    }

    /** Returns true if the vault server is reachable (even if locked). */
    public boolean isRunning() {
        try {
            get("/status");
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Returns a list of secret names from the vault.
     * Example response: {"entries":[{"id":"...","name":"OPENAI_KEY","domain":"localhost"}]}
     */
    public List<String> listSecretNames() throws IOException {
        String body = get("/list");
        List<String> names = new ArrayList<>();
        // Minimal JSON parsing — extract "name":"VALUE" pairs from entries array
        int idx = 0;
        while ((idx = body.indexOf("\"name\":", idx)) != -1) {
            idx += 7;
            while (idx < body.length() && body.charAt(idx) != '"') idx++;
            if (idx >= body.length()) break;
            idx++;
            int end = body.indexOf('"', idx);
            if (end == -1) break;
            names.add(body.substring(idx, end));
            idx = end + 1;
        }
        return names;
    }

    // ── Internal helpers ───────────────────────────────────────────────────

    private String get(String path) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        conn.setConnectTimeout(3000);
        conn.setReadTimeout(5000);
        try {
            conn.connect();
            InputStream stream = conn.getResponseCode() == 200
                    ? conn.getInputStream()
                    : conn.getErrorStream();
            if (stream == null) throw new IOException("No response body");
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } finally {
            conn.disconnect();
        }
    }
}
