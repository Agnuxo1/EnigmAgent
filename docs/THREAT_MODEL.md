# EnigmAgent v3 threat model

## Assets and trusted actors

Assets are credential values, encrypted vaults, metadata, master passwords and
broker connection tokens. The operator, broker process, its OS identity, private
configuration and trusted local storage directory are trusted. Agent/framework
processes are not automatically isolated merely because they use a different
object or language. Untrusted generated code must run without the broker's
filesystem, process-memory, debugger, master-password or Docker-administration
access. A separate service identity/container is an operational requirement, not a
property magically supplied by Python or MCP.

## What the tested implementation enforces

Format v2 uses the fixed username-bound Argon2id KDF and AES-256-GCM over the complete
entry set; associated data binds envelope version/KDF/salt. Invalid schemas, tags,
duplicate names/IDs, unsupported KDF parameters and bounded-size violations are
rejected. Failed unlock attempts lock the prior session. Legacy v1 is read-only
until migration. Migration checks every encrypted entry, but cannot prove the
history of previously unauthenticated domain metadata.

Cooperating writers use a storage lock and a revision hash. Each committed vault
replacement follows a flushed temporary write. Failed writes do not update the
session's committed memory. The original v1 file is preserved in `.v1-backup`; later
v2 writes do not replace it. A rolling `.bak` and explicit authenticated recovery
retain previous/damaged bytes. No timer-based lock stealing or silent corrupt-file
replacement occurs. An interrupted initial backup or stale lock requires operator
inspection. A full disk, power loss, filesystem corruption or hostile filesystem
implementation is not assumed to be recoverable automatically.

REST requires authentication, checks Host and methods, rejects browser origins,
and bounds request bodies, headers, connections and deadlines. Its default listener
is loopback. Explicit container binding to 0.0.0.0 requires host-loopback publishing
and network isolation. MCP stdio trusts the process launcher/transport owner, handles
invalid frames without invoking tools, and never executes a notification as a tool.

The broker takes an operation identifier only. Its operator-owned configuration
fixes destination, method, header and credential selector. Only public IPv4 HTTPS
is permitted by default. The explicit loopback option permits fixed 127.0.0.1 HTTP
operations. DNS results are checked and a selected address is pinned for the
request. Redirects are refused. Upstream response bodies/headers are discarded;
only `{operation, status, ok}` leaves the broker. Fixed error codes omit arbitrary
exception details. Broker and raw-resolution modes cannot share a transport.

## Not guaranteed

* A raw resolver returns plaintext to its caller. Placeholder syntax is not a
  security boundary. Do not expose raw resolver outputs to a model.
* A malicious destination can encode information in HTTP status or timing. This
  bounded result policy is not formal noninterference or a no-side-channel proof.
* An administrator, compromised OS, broker process or same-identity debugger may
  read credentials or replace policy. JavaScript/Python memory erasure is not
  guaranteed. Removing environment-map entries does not erase all OS/engine copies.
* The connection token is not per-user/per-operation RBAC. Authorized callers can
  repeat allowed operations and may cause availability/load problems within limits.
* Domain checks on a trusted raw resolver use caller-declared origins. They are not
  signed origin attestations. Subdomains follow the documented legacy-compatible
  matching rule; choose narrow bindings and independently verified broker URLs.
* Whole-file replay, malicious backups, Windows ACLs, network filesystems and
  unsupported host/runtime configurations need additional operational safeguards.
* Browser DOM substitution necessarily exposes submitted values to that page's
  execution environment. Old PWA/GUI/native wrappers have different boundaries and
  are not validated by the v3 Node/Python tests.

## Evidence

See `platforms/mcp-server/tests/` for real crypto, storage, HTTP, CLI and broker
regressions. See the Python native-integration and official MCP interoperability
tests for actual framework execution against synthetic local services. The release
workflow tests Windows/Linux runtimes, installs built distributions and starts the
actual pinned-source Docker image. Public runtime evidence is synthetic and must
never be replaced with real credentials or private documents.
