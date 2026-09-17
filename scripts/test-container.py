"""Build-independent Docker smoke test with synthetic data and host-loopback publishing."""
from pathlib import Path
import argparse, hashlib, http.client, json, os, secrets, subprocess, tempfile, time, uuid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default="enigmagent:3.0.0")
    parser.add_argument("--evidence", default="audit/container-runtime-evidence.json")
    options = parser.parse_args()
    name = "enigmagent-test-" + uuid.uuid4().hex[:12]
    token = secrets.token_hex(32)
    def docker(*args, check=True):
        return subprocess.run(["docker", *args], text=True, capture_output=True, check=check)
    def call(path, authenticated):
        connection = http.client.HTTPConnection("127.0.0.1", 3737, timeout=3)
        try:
            headers = {"Authorization": "Bearer " + token} if authenticated else {}
            body = None
            method = "GET"
            if path == "/resolve":
                method = "POST"; headers["Content-Type"] = "application/json"
                body = json.dumps({"placeholder": "TOKEN", "origin": "https://example.com"})
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            return response.status, json.loads(response.read(16384))
        finally:
            connection.close()
    with tempfile.TemporaryDirectory(prefix="enigmagent-container-") as temporary:
        directory = Path(temporary)
        environment = directory / "test.env"
        environment.write_text("ENIGMAGENT_USER=synthetic-user\nENIGMAGENT_PASS=synthetic-password-only\nENIGMAGENT_API_TOKEN=" + token + "\n", encoding="utf-8")
        environment.chmod(0o600)
        data = directory / "data"; data.mkdir()
        user = ["--user", f"{os.getuid()}:{os.getgid()}"] if hasattr(os, "getuid") else []
        try:
            docker("run", "--rm", *user, "--env-file", str(environment), "-v", f"{data}:/data",
                   "--entrypoint", "node", options.image, "/app/vault-cli.js", "create")
            docker("run", "-d", "--name", name, *user, "--read-only", "--cap-drop", "ALL",
                   "--security-opt", "no-new-privileges", "--env-file", str(environment),
                   "-v", f"{data}:/data:ro", "-p", "127.0.0.1:3737:3737", options.image,
                   "--mode", "rest", "--bind", "0.0.0.0", "--port", "3737")
            end = time.monotonic() + 60
            while True:
                try:
                    status, health = call("/status", True)
                    if status == 200: break
                except (OSError, http.client.HTTPException, ValueError):
                    pass
                if time.monotonic() >= end: raise RuntimeError("Synthetic container did not become ready")
                time.sleep(0.2)
            assert health["version"] == "3.0.0" and health["vaultFormat"] == 2
            assert health["rawResolveEnabled"] is False
            assert call("/status", False)[0] == 401
            assert call("/list", True) == (200, {"entries": []})
            assert call("/resolve", True)[0] == 403
            details = json.loads(docker("inspect", name).stdout)[0]
            bindings = details["HostConfig"]["PortBindings"]["3737/tcp"]
            assert bindings == [{"HostIp": "127.0.0.1", "HostPort": "3737"}]
            assert details["HostConfig"]["ReadonlyRootfs"] is True
            image = json.loads(docker("image", "inspect", options.image).stdout)[0]
            assert image["Config"]["User"] == "node"
            revision = image["Config"]["Labels"].get("org.opencontainers.image.revision")
            expected_revision = os.environ.get("GITHUB_SHA")
            if expected_revision: assert revision == expected_revision
            report = {"version": "3.0.0", "image_id": image["Id"], "source_revision": revision,
                "image_default_user": "node", "host_binding": "127.0.0.1:3737",
                "read_only_filesystem": True, "capabilities_dropped": True, "vault_format": 2,
                "authenticated_health": 200, "unauthenticated_health": 401,
                "metadata_endpoint": 200, "raw_resolution_default_denial": 403, "synthetic_data_only": True}
            destination = Path(options.evidence); destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(report))
        finally:
            docker("rm", "-f", name, check=False)


if __name__ == "__main__":
    main()
