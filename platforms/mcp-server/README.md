# EnigmAgent gateway 3.0.0

The package includes an MCP stdio server, authenticated REST server, fixed-operation
broker, trusted Node client, authenticated vault core and interactive administrator.
Node.js 22+ is required. The runtime source and LICENSE are included in the package.

## Local source verification

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
node tests/verify-package.mjs
```

The `enigmagent-mcp` executable starts the gateway. `enigmagent-vault` manages vaults;
run its `--help` for create/add/export/migration/recovery operations. No master
password is read from MCP protocol stdin. Gateway startup requires
`ENIGMAGENT_USER` and `ENIGMAGENT_PASS`; REST also requires a random
`ENIGMAGENT_API_TOKEN`. The master password is removed from the process environment
map after capture, but JavaScript/OS memory erasure is not guaranteed.

## Broker configuration

Pass `--operations` with an operator-owned JSON file containing an array of fixed
operations. Each entry has `name`, `url` and `secret`; optional fields are `method`
(GET/HEAD), `header` (one of the documented authentication headers) and `prefix`.
This configuration is a trusted policy file, not model input. Public IPv4 HTTPS
is the default egress policy; `--allow-loopback-operations` permits explicitly
configured 127.0.0.1 HTTP endpoints. The model chooses only an operation name.

| Interface | Purpose |
|---|---|
| MCP `enigmagent_list` | Sensitive metadata only, never entry values |
| MCP `enigmagent_operations` | Configured operation names |
| MCP `enigmagent_execute` | Execute one fixed request; status-only output |
| REST `GET /status` | Authenticated health and policy metadata |
| REST `GET /list` | Authenticated entry metadata |
| REST `GET /operations` | Authenticated operation names |
| REST `POST /execute` | Authenticated fixed operation |

Raw `enigmagent_resolve` / `POST /resolve` requires `--allow-raw-resolve`, cannot
coexist with broker mode and returns plaintext to a trusted caller. It is not a
model-isolating API. Browser origins are rejected by the machine-to-machine REST
interface. `--bind 0.0.0.0` is an explicit container option, not the default; publish
only host loopback. The REST API is not MCP over HTTP.

## Node client

```javascript
import { VaultClient } from 'enigmagent-mcp';
const client = new VaultClient({ token: process.env.ENIGMAGENT_API_TOKEN });
const operations = await client.operations();
const result = await client.execute('check');
```

The operator must configure the named operation first. Do not put real connection
tokens, passwords or credential values into source examples, prompts or logs.

New vaults use authenticated format v2. Legacy v1 vaults are read-only until
explicit migration; their old domain metadata cannot be retroactively proven
untampered. Browser v1 exports and Node v2 envelopes are different formats.
Read `docs/INTEGRATED_RELEASE_V3.md` and `docs/THREAT_MODEL.md` in the source release
for the full limits, backup/recovery contract and OS process isolation requirements.
A registry descriptor for an older package version is historical, not publication
of this v3 build. Tagged GitHub assets and their manifests identify this release.
