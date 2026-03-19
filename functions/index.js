const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

/**
 * Exchanges a Firebase ID token (from Microsoft sign-in) for a custom token
 * so the React Native app can sign in with signInWithCustomToken.
 * POST body: { idToken: string }
 * Response: { customToken: string }
 */
exports.exchangeToken = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const idToken = req.body?.idToken || (req.body && req.body.idToken);
    if (!idToken) {
      res.status(400).json({ error: 'idToken required' });
      return;
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const customToken = await admin.auth().createCustomToken(decoded.uid);
      res.json({ customToken });
    } catch (err) {
      console.error('exchangeToken error:', err.message);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  });
});
