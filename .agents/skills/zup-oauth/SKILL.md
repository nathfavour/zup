---
name: zup-oauth
description: Sign in with Kylrix OAuth 2.1 PKCE authorization flow, token exchange, and NIP-78 identity anchoring.
---

# Sign In with Kylrix (OAuth 2.1 PKCE)

## PKCE Flow
1. **Authorization Request**:
   - Endpoints: `https://www.kylrix.space/oauth/consent` (or local `http://localhost:3005/oauth/consent`)
   - `client_id`: `zup-nostr-client`
   - `response_type`: `code`
   - `code_challenge_method`: `S256`
   - Scopes: `openid profile email notes:read profile:read`
2. **Callback Handling**:
   - Detect `?code=` and `?state=` in `window.location.search`.
   - Validate `state` against `sessionStorage`.
   - Post to `https://www.kylrix.space/api/v1/oauth/token` with `grant_type=authorization_code`, `code`, `code_verifier`, and `redirect_uri`.
   - Fetch user info from `/api/v1/me`.
3. **NIP-78 Identity Binding**:
   - Publish Kind 30078 event to Nostr relays with tag `["d", "kylrix:identity_binding"]` to anchor the sovereign relationship.
4. **Safe Disconnect**:
   - Disconnecting clears OAuth tokens and sets `syncOrigin` to `local_only`.
   - Never purge local private keys, seed phrases, or RxDB notes.
