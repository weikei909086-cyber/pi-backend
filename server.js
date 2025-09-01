
import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

// ---- Guardrails: fail fast if critical env vars are missing ---------------
if (!process.env.PI_SERVER_API_KEY) {
  console.error("[BOOT] Missing PI_SERVER_API_KEY env var.");
}
if (!process.env.ALLOWED_ORIGIN) {
  console.warn("[BOOT] ALLOWED_ORIGIN not set; CORS will allow all (*) for testing only.");
}

const app = express();
app.use(express.json());

// Handle CORS (allow comma-separated origins)
const allowed = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",").map(s => s.trim())
  : ["*"];

app.use(
  cors({
    origin: function (origin, cb) {
      // In Pi Browser, origin can be null (file://); allow if wildcard
      if (allowed.includes("*") || !origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: Origin not allowed: " + origin));
    },
    methods: ["POST", "GET", "OPTIONS"],
    credentials: false,
  })
);

// Quick preflight route (optional)
app.options("*", cors());

const PI_API = "https://api.minepi.com/v2";
const AUTH_HEADER = { Authorization: `Key ${process.env.PI_SERVER_API_KEY}` };

// Toggle validation via env (VALIDATE=0 disables)
const VALIDATE = process.env.VALIDATE === "0" ? false : true;

async function getPayment(paymentId) {
  const { data } = await axios.get(`${PI_API}/payments/${paymentId}`, {
    headers: AUTH_HEADER,
  });
  return data;
}

// Health & config (safe) -----------------------------------------------------
app.get("/health", (_, res) => res.json({ ok: true }));

app.get("/config", (_, res) => {
  const masked = process.env.PI_SERVER_API_KEY
    ? process.env.PI_SERVER_API_KEY.slice(0, 6) + "…" + process.env.PI_SERVER_API_KEY.slice(-4)
    : null;
  res.json({
    allowedOrigin: allowed,
    hasApiKey: !!process.env.PI_SERVER_API_KEY,
    apiKeyMasked: masked,
    validate: VALIDATE,
  });
});

// Approve --------------------------------------------------------------------
app.post("/approve", async (req, res) => {
  const start = Date.now();
  try {
    const { paymentId, expectedAmount, expectedMemo } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    // Optional validation against Pi's copy of the payment
    if (VALIDATE) {
      const p = await getPayment(paymentId);
      if (expectedAmount != null && Number(p.amount) !== Number(expectedAmount)) {
        return res.status(400).json({ error: "Amount mismatch", got: p.amount, expected: expectedAmount });
      }
      if (expectedMemo && p.memo !== expectedMemo) {
        return res.status(400).json({ error: "Memo mismatch", got: p.memo, expected: expectedMemo });
      }
    }

    const { data } = await axios.post(
      `${PI_API}/payments/${paymentId}/approve`,
      {},
      { headers: AUTH_HEADER }
    );
    console.log(`[APPROVE] ${paymentId} -> OK in ${Date.now()-start}ms`);
    return res.json(data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const payload = err?.response?.data || { message: err.message };
    console.error(`[APPROVE] ERR status=${status}`, payload);
    return res.status(status).json({ error: "approve_failed", detail: payload });
  }
});

// Complete -------------------------------------------------------------------
app.post("/complete", async (req, res) => {
  const start = Date.now();
  try {
    const { paymentId, txid } = req.body || {};
    if (!paymentId || !txid) {
      return res.status(400).json({ error: "paymentId and txid required" });
    }
    const { data } = await axios.post(
      `${PI_API}/payments/${paymentId}/complete`,
      { txid },
      { headers: AUTH_HEADER }
    );
    console.log(`[COMPLETE] ${paymentId} -> OK in ${Date.now()-start}ms tx=${txid}`);
    return res.json(data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const payload = err?.response?.data || { message: err.message };
    console.error(`[COMPLETE] ERR status=${status}`, payload);
    return res.status(status).json({ error: "complete_failed", detail: payload });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Pi backend running on :${port}`));
