# Skill: Nostr Cryptography & Zero-Knowledge Vault (`nostr-crypto`)

This skill defines the cryptographic protocols, key derivation functions, Schnorr signing standards, and in-memory key handling for the **zup** ecosystem.

---

## 1. Zero-Knowledge Root Mandate
- **Invariant 1**: Raw `nsec` (private key) and the Master Encryption Key (MEK) **MUST NEVER** persist unencrypted across disk, network, `localStorage`, or server storage.
- All stored identity keys in IndexedDB (`db.identities`) and keychain slots (`db.keychain`) MUST be wrapped using **AES-GCM (256-bit)** with a cryptographically randomized 12-byte Initialization Vector (IV).
- Wrapping format:
  `wrapped = Base64( IV [12 bytes] || Ciphertext || AuthTag [16 bytes] )`

---

## 2. Key Derivation Functions (KDF)
- **Argon2id (Primary KDF)**:
  - Memory: 65,536 KB (64 MB)
  - Iterations: 3
  - Parallelism: 4
  - Salt: 32-byte cryptographically secure random binary salt
  - Output: 32-byte Key Encryption Key (KEK)
- **PBKDF2 (Fallback KDF)**:
  - HMAC-SHA256 with 100,000 iterations when Argon2id WASM is unavailable.

---

## 3. WebAuthn Passkey Extension
- Evaluate `zup-unified-salt-v1` PRF extension.
- For non-PRF platforms: fallback to deterministic digest `SHA-256(credentialId + userId)`.

---

## 4. BIP-340 Schnorr Signatures & Canonical Serialization
- **Canonical NIP-01 Event Serialization**:
  `JSON.stringify([0, pubkey, created_at, kind, tags, content])`
  Serialized strictly in UTF-8 without extra whitespace or key sorting.
- **Event ID**:
  32-byte SHA-256 digest of the canonical UTF-8 JSON serialization.
- **Schnorr Signing**:
  BIP-340 Schnorr signature using `@noble/curves/secp256k1`.
- **Roundtrip Validation Requirement**:
  Before writing any encrypted blob to Dexie, execute an in-memory decryption test to verify ciphertext integrity.

---

## 5. Volatile RAM Key Lifecycle & Zeroing
- Decrypted keys MUST exist only in memory closures or volatile session state.
- Locking the vault or 10 minutes of inactivity MUST trigger buffer zeroing:
  ```typescript
  // Example zeroing pattern
  buffer.fill(0);
  ```
