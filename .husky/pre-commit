#!/bin/bash
# ============================================================
# MODUL 37.5: Secret-leak prevention — pre-commit hook
# Scans staged files for API keys, tokens, credentials patterns
# Reject commits containing credential literals
# ============================================================

set -euo pipefail

# Patterns that indicate leaked secrets (37.5)
SECRET_PATTERNS=(
  # API keys
  'sk-[a-zA-Z0-9]{20,}'
  'api[_-]?key[_-]?[a-zA-Z0-9]{20,}'
  # AWS keys
  'AKIA[0-9A-Z]{16}'
  'aws[_-]?secret[_-]?access[_-]?key[_-]?[a-zA-Z0-9/+=]{40}'
  # Generic tokens
  'token[_-]?[a-zA-Z0-9]{20,}'
  'bearer[_-]?[a-zA-Z0-9]{20,}'
  # Private keys markers
  '-----BEGIN RSA PRIVATE KEY-----'
  '-----BEGIN EC PRIVATE KEY-----'
  # Database URLs with credentials
  'postgres://[^:]+:[^@]+@'
  'mysql://[^:]+:[^@]+@'
  'mongodb://[^:]+:[^@]+@'
  # Supabase service role key pattern
  'supabase[_-]?service[_-]?role[_-]?key'
  # Generic password patterns in code
  'password\s*=\s*"[^"]{8,}"'
)

# Get staged files (excluding deleted files and binary files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -v -E '\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|mp3|zip|tar|gz|db)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "No text files staged — skipping secret scan"
  exit 0
fi

FOUND_SECRETS=0

for file in $STAGED_FILES; do
  if [ ! -f "$file" ]; then continue; fi

  for pattern in "${SECRET_PATTERNS[@]}"; do
    # Search staged content for pattern
    MATCHES=$(git diff --cached -- "$file" 2>/dev/null | grep -iE "$pattern" || true)

    if [ -n "$MATCHES" ]; then
      echo "⚠️ SECRET DETECTED in $file:"
      echo "$MATCHES" | head -3
      echo ""
      FOUND_SECRETS=1
    fi
  done
done

if [ "$FOUND_SECRETS" -eq 1 ]; then
  echo "❌ COMMIT REJECTED — Potential secret/credential detected in staged files"
  echo ""
  echo "To fix:"
  echo "  1. Remove the secret from your code"
  echo "  2. Use environment variables instead of hardcoding credentials"
  echo "  3. If this is a false positive, add the pattern to .gitsecret-whitelist"
  echo ""
  echo "To bypass (USE WITH CAUTION):"
  echo "  git commit --no-verify"
  echo ""
  exit 1
fi

echo "✅ Secret scan passed — no credentials detected in staged files"
exit 0
