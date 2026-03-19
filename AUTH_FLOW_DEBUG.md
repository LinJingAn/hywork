# Auth Flow Breakdown – "Tenant ID não encontrado"

## What’s happening

The error `Tenant ID não encontrado` comes from the **Core API** (`api-core.hywork.cloud`). It appears when we call the Core API **without** a valid `x-tenant-id` header.

---

## End‑to‑end flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. LOGIN       │     │  2. AUTH API    │     │  3. CORE API    │
│  (Firebase)     │────▶│  (validates)    │────▶│  (needs tenant) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                         │                        │
       │ idToken                  │ token + tenantId       │ x-tenant-id
       │                         │ + collabId             │ (required!)
       ▼                         ▼                        ▼
   User signs in     POST /auth/login          GET /collabs/{id}
   Email/Password    with { idToken }          or GET /collabs/auth/{uid}
   or Microsoft                                Headers: Authorization
                                               + x-tenant-id  ◀── PROBLEM
```

---

## Where it breaks

1. You log in with Firebase and get an `idToken`.
2. The app sends `POST https://hw-cloud-authenticator-.../auth/login` with `{ idToken }`.
3. The Auth API is supposed to return something like: `{ token, tenantId, collabId, userId }`.
4. We parse that and store it in AsyncStorage.
5. On the homescreen, we call the Core API with `Authorization: Bearer <token>` and `x-tenant-id: <tenantId>`.
6. **If we never got `tenantId`**, we cannot add `x-tenant-id`.
7. The Core API responds with `Tenant ID não encontrado`.

So the real problem is: **we never obtain `tenantId`**.

---

## Why we might not get tenantId

1. Auth API does not include it in the response.
2. Auth API uses different field names (e.g. `tenant`, `tenant_id`, nested objects).
3. The token is opaque (random string), not a JWT, so we can’t decode it.
4. `DEFAULT_TENANT_ID` / `YOUR_TENANT_ID` is not set in `config/auth.ts`.

---

## How to inspect the Auth API

In `services/auth.ts`, inside `refreshAuthContextWithFirebase`, we can temporarily add:

```ts
// Temporary: Log raw Auth API response to see structure
console.log('[AUTH DEBUG] Raw Auth API response:', JSON.stringify(parsed, null, 2));
console.log('[AUTH DEBUG] Parsed tenantId:', tenantId, 'collabId:', collabId);
```

Then:

1. Run the app and log in.
2. Open the Metro/Expo dev console (or browser dev tools if on web).
3. Find `[AUTH DEBUG]` logs.
4. Look at the raw response: which fields contain `tenantId` / `tenant_id` / tenant-related data?
5. Adjust `parseAuthApiResponse` to read those fields correctly.

---

## Quick workaround

If you already know your tenant ID, set it in `config/auth.ts`:

```ts
const YOUR_TENANT_ID = 'YOUR-ACTUAL-TENANT-UUID-HERE';  // e.g. from your backend/Insomnia
```

This is used as fallback when the Auth API does not return a tenant.

---

## Summary

| Step | Status |
|------|--------|
| Login via Firebase | ✅ Works |
| Call Auth API with idToken | ✅ Works |
| Auth API returns tenantId | ❌ Unknown / possibly wrong format |
| Store tenantId in app | ❌ Nothing to store |
| Call Core API with x-tenant-id | ❌ Header missing |
| Core API response | ❌ "Tenant ID não encontrado" |

To move forward, either:

- Inspect the Auth API response (via logs) and fix parsing, or
- Hard-code your tenant ID in `config/auth.ts` as shown above.
