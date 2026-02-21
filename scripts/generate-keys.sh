#!/usr/bin/env bash
# Generate Ed25519 keypairs for participants; store public keys for seeding
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KEYS_DIR="${REPO_ROOT}/infra/keys"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$KEYS_DIR" "$SEED_DIR"

if [ "$RESET_KEYS" = "1" ]; then
  rm -f "$KEYS_DIR"/*.pub "$KEYS_DIR"/*.key 2>/dev/null || true
fi

# Use Node to generate Ed25519 keys if available (optional; placeholder writes stub)
if command -v node >/dev/null 2>&1; then
  node -e "
    const crypto = require('crypto');
    const fs = require('fs');
    const keysDir = process.env.KEYS_DIR || '$KEYS_DIR';
    const seedDir = process.env.SEED_DIR || '$SEED_DIR';
    const participants = [
      { id: 'works', name: 'did:web:works.demo.gov' },
      { id: 'vendor', name: 'did:web:vendor.demo.gov' }
    ];
    const out = {};
    participants.forEach(p => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const pub = publicKey.export({ type: 'spki', format: 'pem' });
      const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
      fs.writeFileSync(keysDir + '/' + p.id + '.pub', pub);
      fs.writeFileSync(keysDir + '/' + p.id + '.key', priv);
      const base64 = pub.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, '').replace(/\s/g, '');
      out[p.name] = { publicKey: base64 };
    });
    fs.writeFileSync(seedDir + '/public-keys.json', JSON.stringify(out, null, 2));
    console.log('Keys generated.');
  " || true
fi

if [ ! -f "$SEED_DIR/public-keys.json" ] || ! grep -qE '"publicKey"\s*:\s*"[A-Za-z0-9+/=]{20}' "$SEED_DIR/public-keys.json" 2>/dev/null; then
  echo '{"did:web:works.demo.gov":{"publicKey":""},"did:web:vendor.demo.gov":{"publicKey":""}}' > "$SEED_DIR/public-keys.json"
  echo "Placeholder public-keys.json present. Install Node and re-run to generate real keys."
  exit 1
fi
echo "Key generation step done."
