# EnigmAgent Docker

Run the EnigmAgent vault in a container — PWA on port 8080, optional REST API on port 3737.

## Quick start

```bash
# Build and start (from repo root)
docker compose -f platforms/docker/docker-compose.yml up -d

# Open the vault in your browser
open http://localhost:8080
```

## Vault file

Vault data is stored in `platforms/docker/vault/vault.json` (auto-created on first unlock).
The directory is mounted as a Docker volume, so data persists across container restarts.

## Enable REST API for AI agents

Uncomment the environment variables in `docker-compose.yml`:

```yaml
environment:
  ENIGMAGENT_REST: "true"
  ENIGMAGENT_USER: "alice"
  ENIGMAGENT_PASS: "your-vault-password"
```

Then:
```bash
docker compose up -d
curl -X POST http://localhost:3737/resolve \
  -H 'Content-Type: application/json' \
  -d '{"placeholder":"API_KEY","origin":"https://api.example.com"}'
```

## Build from scratch

```bash
# From repo root
docker build -f platforms/docker/Dockerfile -t enigmagent .
docker run -p 8080:8080 -v ./platforms/docker/vault:/data enigmagent
```

## Security

- The container binds to all interfaces (`0.0.0.0`) — add a reverse proxy with TLS for production
- REST API (`3737`) should be firewall-restricted or only accessible via localhost
- The vault file is encrypted at rest; the container only holds the decryption key in memory
