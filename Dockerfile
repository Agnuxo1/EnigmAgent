# Build from the reviewed gateway source, never a separately published npm latest.
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
ARG SOURCE_REVISION=local-uncommitted
LABEL org.opencontainers.image.source="https://github.com/Agnuxo1/EnigmAgent" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision=$SOURCE_REVISION
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node platforms/mcp-server/package.json platforms/mcp-server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node platforms/mcp-server/*.js ./
COPY --chown=node:node platforms/mcp-server/README.md platforms/mcp-server/LICENSE ./
USER node
VOLUME ["/data"]
ENV ENIGMAGENT_VAULT=/data/vault.json
ENTRYPOINT ["node", "/app/index.js"]
CMD ["--mode", "mcp"]
