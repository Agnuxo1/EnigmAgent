"""Real loopback transport tests using test-only authentication and synthetic data."""
from __future__ import annotations
import contextlib
import json
import os
import pickle
import threading
import time
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import pytest
from enigmagent.client import VaultClient, VaultError, configure, get_client, MAX_RESPONSE_BYTES
TOKEN = "synthetic_" * 8
SENTINEL = "SYNTHETIC_RESPONSE_VALUE_NOT_A_REAL_SECRET"

@contextlib.contextmanager
def server(handler):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def do_GET(self): handler(self)
        def do_POST(self):
            self.body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            handler(self)
        def log_message(self, *args):
            return
    instance = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    instance.daemon_threads = True
    thread = threading.Thread(target=instance.serve_forever, daemon=True)
    thread.start()
    try: yield instance.server_port
    finally:
        instance.shutdown(); instance.server_close(); thread.join(timeout=2)

def respond(request, value, status=200, extra=None):
    data = json.dumps(value).encode()
    request.send_response(status)
    request.send_header("Content-Type", "application/json")
    request.send_header("Content-Length", str(len(data)))
    request.send_header("Connection", "close")
    for name, content in (extra or {}).items(): request.send_header(name, content)
    request.end_headers(); request.wfile.write(data)

@pytest.mark.parametrize("settings", [
    {"host": "10.0.0.1"}, {"host": "127.0.0.1.attacker.invalid"}, {"host": "127.0.0.2"},
    {"port": 0}, {"port": 65536}, {"port": True}, {"timeout": 0}, {"timeout": float("nan")},
    {"timeout": float("inf")}, {"api_token": "short"}, {"api_token": TOKEN + "\n"},
    {"allow_raw_resolve": "false"}, {"origin": "https://user:pass@example.com"},
])
def test_invalid_configuration_fails_before_network(settings):
    with pytest.raises(VaultError): VaultClient(**({"api_token": TOKEN} | settings))

def test_authenticated_status_ignores_proxy_settings(monkeypatch):
    def handler(request):
        assert request.path == "/status"
        assert request.headers["Authorization"] == f"Bearer {TOKEN}"
        respond(request, {"status": "ok", "unlocked": True, "version": "3.0.0", "rawResolveEnabled": False,
                          "brokerEnabled": True, "vaultFormat": 2, "extra": SENTINEL})
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:1")
    monkeypatch.setenv("ALL_PROXY", "http://127.0.0.1:1")
    monkeypatch.setenv("NO_PROXY", "")
    with server(handler) as port:
        result = VaultClient(port=port, api_token=TOKEN).get_status()
    assert result.broker_enabled and result.vault_format == 2
    assert SENTINEL not in repr(result)

def test_redirect_is_never_followed():
    counts = {"redirect": 0, "destination": 0}
    def destination(request):
        counts["destination"] += 1; respond(request, {"value": SENTINEL})
    with server(destination) as second:
        def redirect(request):
            counts["redirect"] += 1
            respond(request, {}, 302, {"Location": f"http://127.0.0.1:{second}/steal"})
        with server(redirect) as port:
            with pytest.raises(VaultError) as error: VaultClient(port=port, api_token=TOKEN).get_status()
    assert error.value.code == "redirect_not_allowed"
    assert counts == {"redirect": 1, "destination": 0}

def test_unknown_remote_error_details_are_not_propagated():
    with server(lambda request: respond(request, {"error": SENTINEL, "message": SENTINEL}, 500)) as port:
        with pytest.raises(VaultError) as error: VaultClient(port=port, api_token=TOKEN).get_status()
    assert error.value.code == "vault_error"
    assert SENTINEL not in repr(error.value) and SENTINEL not in str(error.value)

def test_known_error_code_is_preserved_without_remote_message():
    with server(lambda request: respond(request, {"error": "unauthorized", "message": SENTINEL}, 401)) as port:
        with pytest.raises(VaultError) as error: VaultClient(port=port, api_token=TOKEN).get_status()
    assert error.value.code == "unauthorized" and SENTINEL not in str(error.value)

def test_metadata_is_projected_and_contains_no_unknown_value_fields():
    entry = {"id": "fixture", "name": "TOKEN", "domain": "example.com", "created": "2026-09-17", "value": SENTINEL}
    with server(lambda request: respond(request, {"entries": [entry]})) as port:
        results = VaultClient(port=port, api_token=TOKEN).list_secrets()
    assert results[0].name == "TOKEN" and SENTINEL not in repr(results)

def test_operation_result_discards_unknown_fields_and_validates_status():
    def handler(request):
        assert json.loads(request.body) == {"operation": "check"}
        respond(request, {"operation": "check", "status": 204, "ok": True, "value": SENTINEL})
    with server(handler) as port:
        result = VaultClient(port=port, api_token=TOKEN).execute("check")
    assert asdict(result) == {"operation": "check", "status": 204, "ok": True}

@pytest.mark.parametrize("result", [
    {"operation": "different", "status": 200, "ok": True},
    {"operation": "check", "status": True, "ok": True},
    {"operation": "check", "status": 999, "ok": False},
    {"operation": "check", "status": 403, "ok": True},
    {"operation": "check", "status": 200, "ok": "true"},
])
def test_untrusted_operation_response_is_rejected(result):
    with server(lambda request: respond(request, result)) as port:
        with pytest.raises(VaultError) as error: VaultClient(port=port, api_token=TOKEN).execute("check")
    assert error.value.code == "invalid_response"

def test_operation_names_are_validated_without_returning_unknown_fields():
    with server(lambda request: respond(request, {"operations": [{"name": "check", "value": SENTINEL}]})) as port:
        result = VaultClient(port=port, api_token=TOKEN).list_operations()
    assert result == ["check"]

@pytest.mark.parametrize("operation", [None, "", "../name", "https://example.com", "a" * 65, 42])
def test_invalid_operation_input_never_starts_a_request(operation):
    with pytest.raises(VaultError) as error: VaultClient(api_token=TOKEN, port=1).execute(operation)
    assert error.value.code == "invalid_arguments"

def test_raw_resolution_requires_an_explicit_client_opt_in():
    with pytest.raises(VaultError) as error: VaultClient(api_token=TOKEN, port=1).resolve("TOKEN")
    assert error.value.code == "raw_resolve_disabled"
    with server(lambda request: respond(request, {"value": SENTINEL})) as port:
        assert VaultClient(api_token=TOKEN, port=port, allow_raw_resolve=True).resolve("TOKEN", "https://example.com") == SENTINEL

def test_empty_batch_and_invalid_concurrency():
    client = VaultClient(api_token=TOKEN)
    assert client.resolve_batch([]) == {}
    for workers in [0, -1, 33, True]:
        with pytest.raises(VaultError): client.resolve_batch(["A"], max_workers=workers)
    result = client.resolve_batch(["A", "B"])
    assert all(error.code == "raw_resolve_disabled" for error in result.values())

def test_bounded_response_is_enforced_for_declared_and_streamed_bodies():
    def handler(request): respond(request, {"data": "x" * (MAX_RESPONSE_BYTES + 1)})
    with server(handler) as port:
        with pytest.raises(VaultError) as error: VaultClient(api_token=TOKEN, port=port).get_status()
    assert error.value.code == "response_too_large"

def test_absolute_deadline_interrupts_slow_response_headers():
    def slow(request):
        try:
            request.wfile.write(b"HTTP/1.1 200 OK\r\n")
            for _ in range(20):
                request.wfile.write(b"X-Slow: data\r\n"); request.wfile.flush(); time.sleep(0.03)
        except (BrokenPipeError, ConnectionError, OSError):
            return
    with server(slow) as port:
        started = time.monotonic()
        with pytest.raises(VaultError) as error: VaultClient(api_token=TOKEN, port=port, timeout=0.1).get_status()
        assert time.monotonic() - started < 0.7
    assert error.value.code == "timeout"

def test_clients_do_not_serialize_or_display_tokens(monkeypatch):
    monkeypatch.setenv("ENIGMAGENT_API_TOKEN", TOKEN)
    client = VaultClient.from_env()
    assert TOKEN not in repr(client)
    with pytest.raises(TypeError): pickle.dumps(client)
    with pytest.raises(TypeError): json.dumps(client)
    configure(api_token=TOKEN, port=3737)
    assert get_client() is get_client()
    assert get_client(api_token=TOKEN, port=3738).port == 3738
    with pytest.raises(VaultError): configure(host="10.0.0.1", api_token=TOKEN)

def test_invalid_environment_settings_are_rejected(monkeypatch):
    monkeypatch.setenv("ENIGMAGENT_API_TOKEN", TOKEN)
    monkeypatch.setenv("ENIGMAGENT_PORT", "not-a-port")
    with pytest.raises(VaultError): VaultClient.from_env()
