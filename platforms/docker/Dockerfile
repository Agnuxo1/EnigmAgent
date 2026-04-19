# EnigmAgent — Docker image
#
# Serves the vault PWA on port 8080 and optionally the REST API on 3737.
# The vault file is mounted as a volume at /data/vault.json.
#
# Build:
#   docker build -t enigmagent .
#
# Run (PWA only — manage secrets via browser):
#   docker run -p 8080:8080 -v ./vault:/data enigmagent
#
# Run (PWA + REST API for AI agents):
#   docker run -p 8080:8080 -p 3737:3737 -v ./vault:/data \
#     -e ENIGMAGENT_USER=alice \
#     -e ENIGMAGENT_PASS=mypassword \
#     -e ENIGMAGENT_REST=true \
#     enigmagent

FROM node:20-alpine AS base
LABEL maintainer="Francisco Angulo de Lafuente <agnuxo1@gmail.com>"
LABEL description="EnigmAgent encrypted vault — PWA + REST API for AI agents"

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
COPY platforms/shared/package.json ./shared/
COPY platforms/mcp-server/package.json ./mcp-server/

RUN cd shared && npm install --production --ignore-scripts && \
    cd ../mcp-server && npm install --production --ignore-scripts

# ── Copy source files ─────────────────────────────────────────────────────────
COPY platforms/shared/vault-core.js ./shared/
COPY platforms/mcp-server/index.js  ./mcp-server/

# ── Copy PWA files (after setup — style.css + argon2id.js must be present) ───
COPY extension/style.css              ./pwa/style.css
COPY extension/lib/argon2id.js        ./pwa/lib/argon2id.js
COPY extension/icons/icon-128.png     ./pwa/icons/icon-128.png
COPY platforms/pwa/index.html         ./pwa/index.html
COPY platforms/pwa/vault-pwa.js       ./pwa/vault-pwa.js
COPY platforms/pwa/sw.js              ./pwa/sw.js
COPY platforms/pwa/manifest.webmanifest ./pwa/manifest.webmanifest

# Copy icon as 192/512 aliases
RUN cp ./pwa/icons/icon-128.png ./pwa/icons/icon-192.png && \
    cp ./pwa/icons/icon-128.png ./pwa/icons/icon-512.png

# ── Static server script ──────────────────────────────────────────────────────
COPY platforms/docker/server.js ./server.js

# ── Runtime setup ─────────────────────────────────────────────────────────────
RUN mkdir -p /data

EXPOSE 8080 3737

VOLUME ["/data"]

ENV ENIGMAGENT_VAULT=/data/vault.json
ENV ENIGMAGENT_REST=false
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
