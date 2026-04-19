#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# EnigmAgent × Paperclip — integration verification script
#
# Usage: ./verify.sh [--port 3737] [--host 127.0.0.1]
#
# Checks:
#   1. Vault server is reachable
#   2. Vault is unlocked
#   3. Secret resolution works end-to-end
#   4. Paperclip secrets provider is configured correctly
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

HOST="${ENIGMAGENT_HOST:-127.0.0.1}"
PORT="${ENIGMAGENT_PORT:-3737}"
BASE="http://$HOST:$PORT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
pass() { echo -e "${GREEN}  ✅ PASS${NC}  $*"; }
fail() { echo -e "${RED}  ❌ FAIL${NC}  $*"; FAILED=$((FAILED+1)); }
info() { echo -e "${BLUE}  ·${NC}      $*"; }

FAILED=0

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  EnigmAgent × Paperclip — integration check"
echo "  Vault: $BASE"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Server reachable ────────────────────────────────────────────────────────

echo "1. Vault server reachability"
STATUS_RESP=$(curl -sf --max-time 5 "$BASE/status" 2>/dev/null || echo "ERROR")

if [ "$STATUS_RESP" = "ERROR" ]; then
  fail "Cannot reach $BASE/status"
  echo ""
  echo "   Start the vault server:"
  echo "   enigmagent-mcp --mode rest --port $PORT --vault ~/.enigmagent/vault.json"
  echo ""
  exit 1
else
  pass "Server reachable at $BASE"
  info "Response: $STATUS_RESP"
fi

# ── 2. Vault unlocked ─────────────────────────────────────────────────────────

echo ""
echo "2. Vault lock state"
UNLOCKED=$(echo "$STATUS_RESP" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).unlocked' 2>/dev/null || echo "false")

if [ "$UNLOCKED" = "true" ]; then
  pass "Vault is unlocked"
else
  fail "Vault is LOCKED"
  echo "   Restart the server to unlock:"
  echo "   enigmagent-mcp --mode rest --port $PORT --vault ~/.enigmagent/vault.json"
fi

# ── 3. List secrets ────────────────────────────────────────────────────────────

echo ""
echo "3. Secret listing"
LIST_RESP=$(curl -sf --max-time 5 "$BASE/list" 2>/dev/null || echo "ERROR")

if [ "$LIST_RESP" = "ERROR" ]; then
  fail "GET /list failed"
else
  COUNT=$(echo "$LIST_RESP" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).entries.length' 2>/dev/null || echo "?")
  pass "Listed secrets — count: $COUNT"
  info "Response: $LIST_RESP"
fi

# ── 4. Add a test secret and resolve it ───────────────────────────────────────

echo ""
echo "4. End-to-end secret resolution"

# Add a test secret (if enigmagent CLI available)
if command -v enigmagent &>/dev/null; then
  info "Adding test secret ENIGMAGENT_VERIFY_TOKEN @localhost…"
  enigmagent add ENIGMAGENT_VERIFY_TOKEN @localhost "paperclip-integration-ok" 2>/dev/null || true

  RESOLVE_RESP=$(curl -sf --max-time 5 \
    -X POST "$BASE/resolve" \
    -H "Content-Type: application/json" \
    -d '{"placeholder":"ENIGMAGENT_VERIFY_TOKEN","origin":"http://localhost"}' \
    2>/dev/null || echo "ERROR")

  if echo "$RESOLVE_RESP" | grep -q '"value"'; then
    VALUE=$(echo "$RESOLVE_RESP" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).value' 2>/dev/null)
    if [ "$VALUE" = "paperclip-integration-ok" ]; then
      pass "Secret resolved correctly: ENIGMAGENT_VERIFY_TOKEN → $VALUE"
    else
      fail "Unexpected value: $VALUE"
    fi
  else
    fail "Resolution failed: $RESOLVE_RESP"
  fi
else
  info "enigmagent CLI not available — skipping end-to-end resolution test"
fi

# ── 5. Check .env configuration ───────────────────────────────────────────────

echo ""
echo "5. Paperclip configuration"
ENV_FILE="${1:-.env}"
if [ -f "$ENV_FILE" ]; then
  if grep -q "PAPERCLIP_SECRETS_PROVIDER=enigmagent" "$ENV_FILE" 2>/dev/null; then
    pass "PAPERCLIP_SECRETS_PROVIDER=enigmagent found in $ENV_FILE"
  else
    fail "PAPERCLIP_SECRETS_PROVIDER=enigmagent not set in $ENV_FILE"
    echo "   Add to $ENV_FILE:"
    echo "   PAPERCLIP_SECRETS_PROVIDER=enigmagent"
  fi
else
  info "No .env file found at $ENV_FILE — check your environment manually"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed.${NC} EnigmAgent × Paperclip is ready."
else
  echo -e "  ${RED}$FAILED check(s) failed.${NC} See details above."
fi
echo "═══════════════════════════════════════════════════════"
echo ""

exit $FAILED
