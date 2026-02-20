#!/usr/bin/env node
/**
 * Smoke test: verify a proof's signature using the issuer's public key from the directory.
 * Usage: node scripts/verify-proof-smoke.js <proof.json> <participantId> [directoryUrl]
 * Example: node scripts/verify-proof-smoke.js /tmp/work-proof.json did:web:works.demo.gov
 */
const fs = require('fs');
const http = require('http');

const proofPath = process.argv[2];
const participantId = process.argv[3];
const directoryUrl = process.argv[4] || 'http://127.0.0.1:8081';

if (!proofPath || !participantId) {
  console.error('Usage: node scripts/verify-proof-smoke.js <proof.json> <participantId> [directoryUrl]');
  process.exit(1);
}

const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (r) => {
      let b = '';
      r.on('data', (c) => (b += c));
      r.on('end', () => {
        if (r.statusCode !== 200) {
          reject(new Error(`GET ${url} -> ${r.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const crypto = require('../packages/shared-crypto/dist/index.js');
  const participant = await get(`${directoryUrl}/v1/participants/${encodeURIComponent(participantId)}`);
  const key = participant.keys && participant.keys[0];
  if (!key || !key.publicKey) {
    console.error('No public key for participant');
    process.exit(1);
  }
  const pem = crypto.publicKeyPemFromBase64(key.publicKey);
  const ok = crypto.verifyProofSignature(proof, pem);
  if (!ok) {
    console.error('Signature verification failed');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
