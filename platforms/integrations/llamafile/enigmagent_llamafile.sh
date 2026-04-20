#!/usr/bin/env bash
# EnigmAgent × llamafile integration
# =====================================
# Resolves {{PLACEHOLDER}} tokens in a prompt, then passes the resolved
# text to llamafile for local inference.
#
# Usage:
#   ./enigmagent_llamafile.sh "Use key {{OPENAI_KEY}} to summarize this."
#   ./enigmagent_llamafile.sh --model ./llama3.llamafile "{{GITHUB_TOKEN}}"
#
# Requirements:
#   enigmagent serve --port 39517
#   llamafile (https://github.com/Mozilla-Ocho/llamafile)

set -euo pipefail

VAULT_URL="${ENIGMAGENT_URL:-http://127.0.0.1:39517}"
VAULT_TOKEN="${ENIGMAGENT_TOKEN:-}"
LLAMAFILE="${LLAMAFILE:-./llama3.llamafile}"
EXTRA_ARGS=()

# ── Parse arguments ───────────────────────────────────────────────────────────
PROMPT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) LLAMAFILE="$2"; shift 2 ;;
    --vault-url) VAULT_URL="$2"; shift 2 ;;
    --vault-token) VAULT_TOKEN="$2"; shift 2 ;;
    --) shift; PROMPT="$*"; break ;;
    *) PROMPT="$1"; shift ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "Usage: $0 [--model path] [--vault-url url] \"Prompt with {{PLACEHOLDERS}}\""
  exit 1
fi

# ── Resolve placeholders ──────────────────────────────────────────────────────
RESOLVED_PROMPT="$PROMPT"
NAMES=$(echo "$PROMPT" | grep -oP '\{\{[A-Za-z0-9_]+\}\}' | sed 's/[{}]//g' | sort -u || true)

for NAME in $NAMES; do
  HEADERS=(-H "Accept: application/json")
  if [[ -n "$VAULT_TOKEN" ]]; then
    HEADERS+=(-H "Authorization: Bearer $VAULT_TOKEN")
  fi
  VALUE=$(curl -sf "${HEADERS[@]}" "${VAULT_URL}/secret/${NAME}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('value',''))" 2>/dev/null || echo "")
  if [[ -n "$VALUE" ]]; then
    RESOLVED_PROMPT="${RESOLVED_PROMPT//\{\{${NAME}\}\}/$VALUE}"
    echo "[EnigmAgent] Resolved: $NAME" >&2
  else
    echo "[EnigmAgent] Warning: secret '$NAME' not found in vault" >&2
  fi
done

# ── Run llamafile ─────────────────────────────────────────────────────────────
echo "[EnigmAgent] Invoking: $LLAMAFILE" >&2
"$LLAMAFILE" -p "$RESOLVED_PROMPT" "${EXTRA_ARGS[@]}"
