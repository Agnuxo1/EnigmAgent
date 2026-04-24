# EnigmAgent MCP Server — Docker image
# Exposes the encrypted vault REST API on port 3737
# Usage:
#   docker run -p 3737:3737 agnuxo1/enigmagent
#   docker run -p 3737:3737 -e ENIGMAGENT_PORT=3737 agnuxo1/enigmagent
#
# The vault data is stored in /data — mount a volume to persist it:
#   docker run -p 3737:3737 -v enigmagent-data:/data agnuxo1/enigmagent

FROM node:20-alpine

LABEL maintainer="Francisco Angulo de Lafuente <agnuxo1@gmail.com>"
LABEL description="EnigmAgent encrypted vault MCP server"
LABEL org.opencontainers.image.source="https://github.com/Agnuxo1/EnigmAgent"
LABEL org.opencontainers.image.licenses="MIT"

# Install the published npm package globally
RUN npm install -g enigmagent-mcp@latest --no-audit --no-fund

# Vault data directory (mount a volume here to persist secrets)
VOLUME ["/data"]
ENV ENIGMAGENT_DATA_DIR=/data

# REST API port
EXPOSE 3737

# Health check — polls the /status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3737/status || exit 1

# Run in REST mode by default so Claude Desktop, n8n, etc. can reach the API
ENTRYPOINT ["enigmagent-mcp", "--mode", "rest", "--port", "3737"]
