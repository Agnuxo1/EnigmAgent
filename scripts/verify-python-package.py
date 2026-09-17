"""Verify the wheel's source equivalence and install it in a clean offline environment."""
from pathlib import Path
import argparse, hashlib, json, os, subprocess, sys, tempfile, venv, zipfile


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("wheel")
    parser.add_argument("--evidence", default=str(root / "audit/python-package-evidence.json"))
    options = parser.parse_args()
    wheel = Path(options.wheel).resolve()
    verified = 0
    with zipfile.ZipFile(wheel) as archive:
        for name in archive.namelist():
            if name.startswith("enigmagent/") and name.endswith(".py"):
                source = root / "platforms/python-sdk" / name
                assert source.is_file() and archive.read(name) == source.read_bytes(), name
                verified += 1
        metadata = next(name for name in archive.namelist() if name.endswith(".dist-info/METADATA"))
        assert "Version: 3.0.0\n" in archive.read(metadata).decode()
        assert "enigmagent/adapters/common.py" in archive.namelist()
    with tempfile.TemporaryDirectory(prefix="enigmagent-wheel-test-") as temporary:
        folder = Path(temporary); environment = folder / "venv"
        venv.EnvBuilder(with_pip=True).create(environment)
        python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        env = {key: os.environ[key] for key in ("PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT") if key in os.environ}
        env.update(HOME=str(folder), USERPROFILE=str(folder), TMP=str(folder), TEMP=str(folder), PYTHONIOENCODING="utf-8")
        subprocess.run([str(python), "-m", "pip", "install", "--no-deps", "--no-index", str(wheel)], env=env, cwd=folder, check=True)
        code = """import json
from enigmagent import __version__
from enigmagent.client import VaultClient, VaultError
from enigmagent.adapters import SUPPORTED_FRAMEWORKS
assert __version__ == '3.0.0'
assert len(SUPPORTED_FRAMEWORKS) == 10
client = VaultClient(api_token='synthetic_' * 8)
assert client.resolve_batch([]) == {}
try:
    client.resolve('TOKEN')
except VaultError as error:
    assert error.code == 'raw_resolve_disabled'
else:
    raise AssertionError('Raw resolution default was not enforced')
print(json.dumps({'version': __version__, 'framework_factories': len(SUPPORTED_FRAMEWORKS), 'raw_default_denied': True}))
"""
        checked = subprocess.run([str(python), "-c", code], env=env, cwd=folder, check=True, capture_output=True, text=True)
        result = json.loads(checked.stdout)
    result.update(wheel=wheel.name, sha256=hashlib.sha256(wheel.read_bytes()).hexdigest(),
                  source_files_verified=verified, clean_offline_install=True, registry_publication=False)
    destination = Path(options.evidence); destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
