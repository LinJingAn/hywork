const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

function initAdmin() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    try {
      const sa = JSON.parse(jsonEnv);
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id || projectId,
      });
      console.log(
        "[exchangeToken] Admin: credential from FIREBASE_SERVICE_ACCOUNT_JSON",
      );
      return;
    } catch (e) {
      console.error(
        "[exchangeToken] FIREBASE_SERVICE_ACCOUNT_JSON invalid",
        e.message,
      );
    }
  }
  // eslint-disable-next-line no-undef -- CommonJS __dirname
  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(keyPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id || projectId,
      });
      console.log(
        "[exchangeToken] Admin: credential from serviceAccountKey.json",
      );
      return;
    } catch (e) {
      console.error(
        "[exchangeToken] serviceAccountKey.json invalid",
        e.message,
      );
    }
  }
  if (projectId) {
    admin.initializeApp({ projectId });
  } else {
    admin.initializeApp();
  }
  console.log(
    "[exchangeToken] Admin: default credentials — createCustomToken needs IAM signBlob on firebase-adminsdk SA",
  );
}

initAdmin();

function tryParseIdToken(json) {
  if (!json || typeof json !== "string") return null;
  try {
    const p = JSON.parse(json);
    return p && p.idToken ? p.idToken : null;
  } catch {
    return null;
  }
}

function peekIdTokenClaims(idToken) {
  if (!idToken || typeof idToken !== "string") {
    return { error: "empty_or_not_string" };
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    return { error: "not_a_jwt", segmentCount: parts.length };
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return {
      aud: payload.aud,
      iss: payload.iss,
      sub: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      sign_in_provider: payload.firebase && payload.firebase.sign_in_provider,
    };
  } catch (e) {
    return { error: "payload_parse_failed", message: e.message };
  }
}

function cors(req, res, next) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

exports.exchangeToken = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    let idToken =
      req.body?.idToken ||
      (req.body && req.body.idToken) ||
      (typeof req.body === "string" ? tryParseIdToken(req.body) : null);
    if (!idToken && req.rawBody) {
      const raw =
        typeof req.rawBody === "string"
          ? req.rawBody
          : Buffer.isBuffer(req.rawBody)
            ? req.rawBody.toString("utf8")
            : "";
      idToken = tryParseIdToken(raw);
    }
    if (typeof idToken === "string") {
      idToken = idToken.trim();
    }
    if (!idToken) {
      console.error("[exchangeToken] missing idToken", {
        hasBody: !!req.body,
        bodyKeys:
          req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
        rawBodyLen: req.rawBody ? String(req.rawBody).length : 0,
      });
      res.status(400).json({ error: "idToken required" });
      return;
    }

    const projectId =
      process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "(unset)";
    const claims = peekIdTokenClaims(idToken);
    console.log("[exchangeToken] request", {
      gcloudProject: projectId,
      idTokenLength: idToken.length,
      tokenClaimsPeek: claims,
      audMatchesProject: claims.aud === projectId,
    });

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      console.log("[exchangeToken] verifyIdToken ok", { uid: decoded.uid });

      try {
        const customToken = await admin.auth().createCustomToken(decoded.uid);
        res.json({ customToken });
      } catch (signErr) {
        const sc = signErr && signErr.code;
        const msg = signErr && signErr.message;
        console.error(
          "[exchangeToken] createCustomToken FAILED (IAM / signing)",
          {
            code: sc,
            message: msg,
            stack: signErr.stack,
            hint: "Grant roles/iam.serviceAccountTokenCreator to the Cloud Functions runtime service account on the Firebase Admin SDK service account. See Firebase docs: createCustomToken + signBlob.",
          },
        );
        const isIam =
          sc === "auth/insufficient-permission" ||
          (typeof msg === "string" && msg.includes("signBlob"));
        if (isIam) {
          res.status(503).json({
            error:
              "Servidor sem permissão para emitir token (IAM signBlob). Corrija no Google Cloud — ver comentário em functions/index.js ou documentação createCustomToken.",
          });
        } else {
          res.status(500).json({ error: "Falha ao criar token de sessão." });
        }
      }
    } catch (err) {
      const code = err && err.code;
      console.error("[exchangeToken] verifyIdToken FAILED", {
        code,
        message: err.message,
        stack: err.stack,
        gcloudProject: projectId,
        tokenClaimsPeek: claims,
        audMatchesProject: claims.aud === projectId,
        hint:
          claims.aud && claims.aud !== projectId
            ? "JWT aud does not match Cloud Function project — fix Firebase web config / deploy target."
            : "See code/message above (expired, malformed, revoked, etc.).",
      });
      res.status(401).json({ error: "Invalid or expired token" });
    }
  });
});
