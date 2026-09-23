---
name: zup-vault
description: Zero-knowledge MEK, Argon2id KEK derivation, WebAuthn passkeys, volatile in-memory key lifecycle, and local RxDB encryption in Zup.
---

# Zup Sovereign Vault & Cryptographic Security

## Core Security Invariants
- **RAM-Only MEK (Zero Trace)**: The 256-bit Master Encryption Key (MEK) is stored strictly in volatile memory (`masterPassCrypto`). It must NEVER be written to unencrypted storage (`localStorage`, `sessionStorage`, cookies, or unencrypted database rows).
- **Argon2id Key Derivation**: User passwords derive a 256-bit Key Encryption Key (KEK) using Argon2id (64MB memory, 3 iterations, 256-bit key length, 32-byte salt). Fallback to PBKDF2 (600,000 iterations, SHA-256) is supported for legacy compatibility.
- **Mandatory Roundtrip Validation**: Every key wrap must pass in-memory verification (`verifyMEKRoundtrip`) before writing encrypted payloads to RxDB.
- **Immediate Lock Memory Zeroing**: When the application locks, the volatile MEK buffer is immediately zeroized with `activeMEK.fill(0)` and context wipes are broadcast across tabs via `BroadcastChannel`.
- **Passkey / Hardware Security**: Supports WebAuthn platform authenticators (Touch ID, Face ID, Windows Hello), cross-platform security keys (YubiKey), and browser enclave keys with latency testing and assertion verification.
