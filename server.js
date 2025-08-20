import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN?.split(",") || "*",
    methods: ["POST", "GET", "OPTIONS"],
  })
);

const PI_API = "https://api.minepi.com/v2";
const AUTH_HEADER = { Authorization: `Key ${process.env.PI_SERVER_API_KEY}` };

async function getPayment(paymentId) {
  const { data } = await axios.get(`${PI_API}/payments/${paymentId}`, {
    headers: AUTH_HEADER,
  });
  return data;
}

app.post("/approve", async (req, res) => {
  try {
    const { paymentId, expectedAmount, expectedMemo } = req.body;
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    // Optional validation against your own order data:
    const p = await getPayment(paymentId);
    if (expectedAmount != null && Number(p.amount) !== Number(expectedAmount)) {
      return res.status(400).json({ error: "Amount mismatch" });
    }
    if (expectedMemo && p.memo !== expectedMemo) {
      return res.status(400).json({ error: "Memo mismatch" });
    }

    const { data } = await axios.post(
      `${PI_API}/payments/${paymentId}/approve`,
      {},
      { headers: AUTH_HEADER }
    );
    return res.json(data);
  } catch (err) {
    console.error("Approve error:", err?.response?.data || err.message);
    const status = err?.response?.status || 500;
    return res.status(status).json({ error: err?.response?.data || err.message });
  }
});

app.post("/complete", async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    if (!paymentId || !txid) {
      return res.status(400).json({ error: "paymentId and txid required" });
    }
    const { data } = await axios.post(
      `${PI_API}/payments/${paymentId}/complete`,
      { txid },
      { headers: AUTH_HEADER }
    );
    return res.json(data);
  } catch (err) {
    console.error("Complete error:", err?.response?.data || err.message);
    const status = err?.response?.status || 500;
    return res.status(status).json({ error: err?.response?.data || err.message });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Pi backend running on :${port}`));
