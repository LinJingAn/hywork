# Microsoft auth page (for native app)

If the app shows **"Site not found"** when you tap "Sign in with Microsoft", this page is not deployed yet. Deploy it (and the Cloud Function) using the steps below.

This page runs the Microsoft OAuth redirect flow so the Android/iOS app can sign in via the in-app browser.

## Deploy to Firebase Hosting

1. In project root, run `firebase init hosting` and choose the `HyWork` project. Set the public directory to `auth-page` (or deploy only this folder).
2. Set the public directory to `auth-page` so the URL is `https://<projectId>.web.app/auth/microsoft.html`.
3. Run `firebase deploy --only hosting`.
4. In Firebase Console → Authentication → Authorized domains, add your hosting domain (e.g. `cloud---homolog.web.app`).
5. In the app, ensure `config/auth.ts` has `MICROSOFT_AUTH_PAGE_URL` set to that URL (e.g. `https://cloud---homolog.web.app/auth/microsoft.html`).

## Deploy the token-exchange Cloud Function

From project root:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Set `EXCHANGE_TOKEN_URL` in `microsoft.html` to your function URL (e.g. `https://us-central1-cloud---homolog.cloudfunctions.net/exchangeToken`).
