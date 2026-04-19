#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# EnigmAgent × Paperclip — installation script
#
# Usage:
#   chmod +x install.sh && ./install.sh
#
# What this does:
#   1. Verifies prerequisites (Node 20+, pnpm, enigmagent-mcp)
#   2. Creates the vault if it doesn't exist
#   3. Installs the Paperclip plugin
#   4. Prints configuration instructions
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[EnigmAgent]${NC} $*"; }
success() { echo -e "${GREEN}[EnigmAgent]${NC} ✅ $*"; }
warn()    { echo -e "${YELLOW}[EnigmAgent]${NC} ⚠  $*"; }
error()   { echo -e "${RED}[EnigmAgent]${NC} ❌ $*"; exit 1; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  EnigmAgent × Paperclip — installation"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Prerequisites ───────────────────────────────────────────────────────────

info "Checking prerequisites…"

# Node.js >= 20
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org (v20+)"
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  error "Node.js v20+ required (found v$NODE_VER)"
fi
success "Node.js v$NODE_VER"

# pnpm or npm
if command -v pnpm &>/dev/null; then
  PKG="pnpm"
elif command -v npm &>/dev/null; then
  PKG="npm"
else
  error "Neither pnpm nor npm found."
fi
success "Package manager: $PKG"

# enigmagent-mcp
if ! command -v enigmagent-mcp &>/dev/null && ! command -v enigmagent &>/dev/null; then
  warn "enigmagent-mcp not found. Installing…"
  npm install -g enigmagent-mcp || error "Failed to install enigmagent-mcp"
  success "enigmagent-mcp installed"
else
  success "enigmagent-mcp found"
fi

# ── 2. Vault setup ─────────────────────────────────────────────────────────────

VAULT_PATH="${ENIGMAGENT_VAULT:-$HOME/.enigmagent/vault.json}"
info "Vault path: $VAULT_PATH"

if [ ! -f "$VAULT_PATH" ]; then
  echo ""
  info "No vault found. Creating one now…"
  echo "  You will be prompted for a username and master password."
  echo "  Choose a strong password — it protects all your secrets."
  echo ""
  enigmagent create --vault "$VAULT_PATH" || error "Vault creation failed"
  success "Vault created at $VAULT_PATH"
else
  success "Vault already exists at $VAULT_PATH"
fi

# ── 3. Install the Paperclip plugin ───────────────────────────────────────────

echo ""
info "Installing @enigmagent/paperclip-plugin…"

# If running from the EnigmAgent repo, install from local path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../packages/plugin-enigmagent" && pwd)"

if [ -d "$PLUGIN_DIR" ]; then
  info "Installing from local source: $PLUGIN_DIR"
  cd "$PLUGIN_DIR"
  $PKG install --frozen-lockfile 2>/dev/null || $PKG install
  $PKG run build || error "Plugin build failed"
  success "Plugin built"

  # Install into Paperclip (if paperclip CLI is available)
  if command -v paperclipai &>/dev/null; then
    paperclipai plugin install "file:$PLUGIN_DIR" || warn "Could not auto-install via CLI — see manual steps below"
    success "Plugin installed via paperclipai CLI"
  else
    warn "paperclipai CLI not found. Install the plugin manually (see instructions below)"
  fi
else
  warn "Local plugin source not found — installing from npm registry"
  if command -v paperclipai &>/dev/null; then
    paperclipai plugin install @enigmagent/paperclip-plugin || error "Plugin install failed"
    success "Plugin installed"
  else
    error "paperclipai CLI not found. Install Paperclip first: https://paperclip.ai"
  fi
fi

# ── 4. Configuration instructions ─────────────────────────────────────────────

PORT="${ENIGMAGENT_PORT:-3737}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Setup complete! Follow these final steps:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "1. Add secrets to your vault:"
echo "   enigmagent add GITHUB_TOKEN    @localhost  ghp_your_token"
echo "   enigmagent add OPENAI_API_KEY  @localhost  sk-your-key"
echo "   enigmagent add LOGIN:gmail.com @localhost  your-password"
echo ""
echo "2. Add to your Paperclip .env file:"
echo "   PAPERCLIP_SECRETS_PROVIDER=enigmagent"
echo "   ENIGMAGENT_HOST=127.0.0.1"
echo "   ENIGMAGENT_PORT=$PORT"
echo ""
echo "3. Start the vault server (keep running while Paperclip is active):"
echo "   enigmagent-mcp --mode rest --port $PORT --vault $VAULT_PATH"
echo ""
echo "4. Start Paperclip normally:"
echo "   pnpm dev   (or your usual start command)"
echo ""
echo "5. In agent configs, use {{ secret.KEY_NAME }} wherever a"
echo "   credential would go. Paperclip resolves it automatically."
echo ""
echo "For more details: platforms/paperclip/doc/enigmagent.md"
echo ""
success "Installation complete."
