"""Build all four Node distributions, verify archive contents and perform a clean install."""
from pathlib import Path
import hashlib, json, os, shutil, subprocess, tempfile, tarfile


def main():
    root = Path(__file__).resolve().parent.parent
    output = root / "release-artifacts"; output.mkdir(exist_ok=True)
    node = shutil.which("node")
    if not node: raise RuntimeError("Node.js is required")
    base = Path(node).resolve().parent
    candidates = [base / "node_modules/npm/bin/npm-cli.js", base.parent / "lib/node_modules/npm/bin/npm-cli.js"]
    npm_path = shutil.which("npm")
    if npm_path: candidates.append(Path(npm_path).resolve())
    npm = next((path for path in candidates if path.name == "npm-cli.js" and path.is_file()), None)
    if npm is None: raise RuntimeError("Cannot locate the npm CLI alongside Node.js")
    reports, archives = [], []
    for relative in ("platforms/mcp-server", "platforms/cli", "platforms/shared", "platforms/npm-library"):
        package = root / relative
        subprocess.run([node, str(npm), "ci", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=package, check=True)
        packed = subprocess.run([node, str(npm), "pack", "--json", "--ignore-scripts", "--pack-destination", str(output)],
            cwd=package, check=True, capture_output=True, text=True)
        result = json.loads(packed.stdout)[0]; archive = output / result["filename"]
        assert result["version"] == "3.0.0"
        paths = []
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar.getmembers():
                if not member.isfile(): continue
                name = member.name.removeprefix("package/")
                assert not name.startswith(("versions/", "audit/", "node_modules/", ".env"))
                source = package / name
                assert source.is_file() and tar.extractfile(member).read() == source.read_bytes(), name
                paths.append(name)
        reports.append({"name": result["name"], "version": "3.0.0", "archive": archive.name,
            "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "source_files_verified": len(paths)})
        archives.append(archive)
    with tempfile.TemporaryDirectory(prefix="enigmagent-node-package-") as temporary:
        folder = Path(temporary)
        (folder / "package.json").write_text('{"private":true,"type":"module"}\n', encoding="utf-8")
        subprocess.run([node, str(npm), "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
                        *map(str, archives)], cwd=folder, check=True)
        probe = folder / "probe.mjs"
        probe.write_text("""import assert from 'node:assert/strict';
import { VaultManager, MemoryStorage } from '@enigmagent/vault';
import { VAULT_VERSION } from '@enigmagent/core';
import { VaultClient } from 'enigmagent-mcp';
assert.equal(VAULT_VERSION, 2);
const vault = new VaultManager(new MemoryStorage());
await vault.create('synthetic-user', 'synthetic-password-only');
await vault.addSecret({ name: 'TOKEN', domain: 'example.com', value: 'SYNTHETIC_PACKAGE_VALUE' });
assert.equal(await vault.resolve('TOKEN', 'https://example.com'), 'SYNTHETIC_PACKAGE_VALUE');
assert(!JSON.stringify(vault.vault).includes('SYNTHETIC_PACKAGE_VALUE'));
vault.lock();
const client = new VaultClient({ token: 'synthetic_'.repeat(8) });
assert.equal(typeof client.execute, 'function');
console.log('Clean installed vault, core and broker client passed');
""", encoding="utf-8")
        subprocess.run([node, str(probe)], cwd=folder, check=True)
        for executable in ("enigmagent-cli/bin/enigmagent.js", "enigmagent-mcp/index.js", "enigmagent-mcp/vault-cli.js"):
            result = subprocess.run([node, str(folder / "node_modules" / executable), "--version"],
                cwd=folder, check=True, capture_output=True, text=True)
            assert result.stdout.strip() == "3.0.0"
    result = {"version": "3.0.0", "clean_install_verified": True, "registry_publication": False, "packages": reports}
    (root / "audit/node-package-evidence.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
