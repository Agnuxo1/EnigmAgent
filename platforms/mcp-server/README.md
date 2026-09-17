# EnigmAgent local gateway 2.0.0

A local encrypted-vault gateway with **metadata-only MCP stdio by default** and a
separate **authenticated loopback REST API**. Plaintext resolution requires an
explicit operator flag. This component is not a context-isolating outbound proxy.

This is a source release in `Agnuxo1/EnigmAgent`. It does not establish that npm,
the MCP registry, Docker images, browser extensions or separately maintained
adapters have been updated. The legacy `server.json` remains a 1.0.0 descriptor,
not a publication record for this source version.

## Run the no-credential demonstration

Requires Node.js 22 or later. From the repository root:

```sh
cd platforms/mcp-server
npm ci --ignore-scripts
npm run demo
npm test
```

The demonstration creates an encrypted vault containing synthetic data in memory,
starts an authenticated server on a random loopback port, checks metadata access,
verifies that raw resolution is denied, and shuts down. It does not open any
personal vault, save a vault to disk or call an external service.

## Migration from the bundled 1.0.0 gateway

| Surface | Version 1.0.0 | Version 2.0.0 |
| --- | --- | --- |
| MCP raw-secret tool | Enabled by default | Absent by default; direct calls also denied |
| REST authentication | None | Bearer token required on every endpoint |
| Browser requests | Origin/Host not checked | Browser Origin rejected; exact local Host required |
| Request bodies / stdio frames | No application size cap | 16 KiB incoming-message limit |
| Invalid MCP `null` message | Process exits | JSON-RPC error; next valid request still works |
| Credentials on startup | Can prompt on protocol stdin | Environment only; no stdin prompts |
| Node runtime | Manifest allowed 18+ | Requires 22+ |
| Encrypted vault format | v1 Argon2id/AES-GCM | Unchanged v1 format |

Older REST adapters without authentication headers will fail closed. Updating the
umbrella repository does not migrate those adapters automatically. Test each one
before production use. Do not restore unauthenticated endpoints for compatibility.

## Using an existing vault

Supply `ENIGMAGENT_USER` and `ENIGMAGENT_PASS` through the trusted process launcher
or a protected local secret mechanism. Do not put real values in Git, tickets,
model prompts, shell-history commands or shared client configuration.

```sh
node index.js --vault ./enigmagent-vault.json --mode mcp
```

MCP stdout is reserved for newline-delimited JSON-RPC. Operational messages go to
stderr. The implemented protocol versions are `2025-06-18` and `2024-11-05`;
this is not a claim of exhaustive support for later protocol revisions.
An MCP session must initialize and send `notifications/initialized` before tools.
Only `enigmagent_list` is advertised by default. Names and domains are metadata,
which may itself be confidential.

For the separate REST API, also provide a randomly generated
`ENIGMAGENT_API_TOKEN` containing 32-256 URL-safe characters. For example, a trusted
Node launcher can generate 32 random bytes with `randomBytes(32).toString('hex')`
and pass the result through its child environment. Format validation does not
prove that an operator-selected token has enough entropy.

```sh
node index.js --vault ./enigmagent-vault.json --mode rest --port 3737
```

The process binds only to `127.0.0.1`. Port `0` selects an available local port.
`ENIGMAGENT_VAULT` overrides `--vault`. No remote listen address is exposed.
The REST interface is **not MCP Streamable HTTP or SSE**.

### Trusted Node client

Use the bundled client from a trusted backend. It has no configurable remote
host, does not use environment proxy settings, does not follow redirects, and
places a one-MiB cap and an absolute deadline on responses.

```js
import { VaultClient } from './client.js';

const client = new VaultClient({
  token: process.env.ENIGMAGENT_API_TOKEN,
  port: 3737,
  timeoutMs: 5000,
});
const status = await client.status();
console.log({ unlocked: status.unlocked, rawResolveEnabled: status.rawResolveEnabled });
```

The package exports `VaultClient` and `VaultClientError` from `enigmagent-mcp` and
`enigmagent-mcp/client` when installed from the built 2.0.0 tarball.
No registry installation instruction is a substitute for checking the installed
version: `enigmagent-mcp --version`.

### Explicit raw-secret mode

`--allow-raw-resolve` enables the plaintext resolver for the selected transport.
Do this **only** for a trusted backend that is meant to receive credentials.
In MCP mode the result may be included in the model context. In REST mode the
trusted application must keep returned values out of tool messages, logs,
checkpoints, traces and arbitrary outbound destinations. A caller-supplied origin
is not proof of who the caller is or where the credential will be used.

| Endpoint | Requirement | Outcome |
| --- | --- | --- |
| `GET /status` | Bearer token | Unlock and policy state |
| `GET /list` | Bearer token; unlocked vault | Selected metadata fields only |
| `POST /resolve` | Bearer token; unlocked vault; raw flag; JSON body | Plaintext value for a matching binding |

Resolver JSON must contain only string fields `placeholder` and `origin`.
Origins must use HTTP(S) without URL credentials. The existing vault's domain
matching rules still apply, including its existing subdomain behavior.
Browser Origin headers are rejected: this is a machine-to-machine interface.
No CORS grant is returned. Token authorization covers the entire unlocked vault;
it is not multi-tenant or per-secret authorization.

## Limits and error handling

REST checks authentication and local Host before vault access. It caps incoming
bodies at 16 KiB, header size at 8 KiB, open connections at 32 and body-read time
at five seconds. Responses have `Cache-Control: no-store`. Only allow-listed
vault error codes reach clients; arbitrary exception text does not.

MCP processes bounded UTF-8 frames sequentially, honors stdout backpressure,
ignores notifications without executing tools, and rejects malformed envelopes.
Oversized or incomplete frames end the transport; invalid JSON or `null` yields
an error without crashing the session. The vault is locked on normal EOF.

## Security boundaries and unfinished project-wide work

This release addresses the bundled gateway, not every EnigmAgent platform.
It does not protect against a compromised operating system, process, trusted
launcher, recipient model or authenticated client. Dropping JavaScript references
is not guaranteed memory erasure. A bearer token is not a user identity system.

The v1 vault core is unchanged. Atomic writes, authenticated entry metadata,
concurrent writers, stricter schema validation and recovery after partial writes
still require a separate migration and audit. Do not describe the whole project
as independently audited or guaranteed to isolate secrets from models.

See [the scoped audit](../../docs/GATEWAY_V2_AUDIT.md),
[the integration plan](../../docs/GATEWAY_V2_INTEGRATION_PLAN.md), and
[the preserved previous version](../../versions/enigmagent-mcp-1.0.0/README.md).
