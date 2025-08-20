# Pi Backend (Approve & Complete Payments)

This is a tiny Express server that approves and completes Pi Wallet payments.

## Quick start

1. **Install**
   ```bash
   npm install
   ```

2. **Configure**
   - Copy `.env.example` to `.env` and set:
     - `PI_SERVER_API_KEY` — from the Pi Developer Portal (API Key screen)
     - `ALLOWED_ORIGIN` — your site URL(s), e.g. `https://your-subdomain.pinet.com`

3. **Run locally**
   ```bash
   npm start
   # open http://localhost:3000/health
   ```

## Deploy options

- **Vercel** (serverless): create a new project and import this repo; add env vars.
- **Render / Railway / Heroku / Fly.io**: create a Node service, set env vars, deploy.

## Endpoints

- `POST /approve` body: `{ "paymentId": "abc", "expectedAmount": 1, "expectedMemo": "Test order" }`
- `POST /complete` body: `{ "paymentId": "abc", "txid": "..." }`

Both use your **Server API Key** securely on the server.

## Frontend wiring (example)

```html
<script src="https://sdk.minepi.com/pi-sdk.js"></script>
<script>
  Pi.init({ version: "2.0" });

  async function pay() {
    await Pi.authenticate(["payments"], () => {});
    await Pi.createPayment(
      { amount: 1, memo: "Test Order #123", metadata: { orderId: "123" } },
      {
        onReadyForServerApproval: async (paymentId) => {
          await fetch("https://YOUR-BACKEND-URL/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, expectedAmount: 1, expectedMemo: "Test Order #123" }),
          });
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          await fetch("https://YOUR-BACKEND-URL/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, txid }),
          });
        },
        onCancel: (e) => console.log("cancel", e),
        onError: (e) => console.error("error", e),
      }
    );
  }
</script>
<button onclick="pay()">Pay with Pi</button>
```

## Notes
- Never put `PI_SERVER_API_KEY` in your frontend.
- If the wallet shows "Preparing for a payment… will expire in 60s", your backend isn't approving.
- Check your backend logs for HTTP 401/403 (bad or missing key).
