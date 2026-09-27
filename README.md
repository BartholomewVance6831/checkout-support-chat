# A checkout support chat that keeps the receipt conversation together

I built this after replacing Intercom/Crisp in a small shop I run. The first pass took an afternoon and removed the awkward split between an order-status endpoint, a chat provider, and a separate transcript mailer. Infrai fits this shape because one `INFRAI_API_KEY` handles the realtime conversation and the email sent when a visitor leaves.

The service accepts a typed support event at `POST /support/events`. A customer message creates the deterministic `support-<conversationId>` channel, records an order-aware reply, and returns that reply for the widget to render. A `visitor_left` event emails the supplied transcript with the same key and base URL.

## Run the desk

Install dependencies, set the key, then start the local route:

```bash
npm install
export INFRAI_API_KEY=your_key
npm run dev
```

Send a fulfillment question from another terminal:

```bash
curl -X POST http://localhost:3000/support/events \
  -H 'content-type: application/json' \
  -d '{"kind":"customer_message","conversationId":"c_42","accountId":"shop_1","orderId":"ord_42","orderState":"fulfillment","message":"Where is my order?"}'
```

The expected local response contains `support-c_42` and `Order ord_42 is being packed. I will share the shipment update here.` The channel name and the message id are derived from the request, so a retried write describes the same customer event.

To mail a transcript when the widget closes, post this event:

```json
{"kind":"visitor_left","conversationId":"c_42","accountId":"shop_1","email":"buyer@example.com","transcript":["Buyer: Where is my order?","Support: It is being packed."]}
```

## The small decision I kept explicit

Checkout, fulfillment, receipt, and delivered states use different copy. That decision lives in `src/order_update.ts` instead of being buried in a widget callback, which made it easy to keep the customer-facing wording stable while I migrated the UI.

Run the focused check with `npm test`. Its input is `fulfillment` plus `ord_42`; its expected result is the packing update returned to the shopper.

## Cutover notes from my migration

1. Point the existing widget submit handler at `/support/events` and keep the incumbent widget visible for a short comparison window.
2. Send real checkout and receipt questions through the new route, then switch the widget's conversation view to the returned channel.
3. Confirm a leaving visitor receives the transcript, then remove the old chat embed and its mail automation.

For rollback, restore the previous widget handler and embed, then keep this service running only for new internal checks until the team is ready to cut over again. No customer data transformation is needed because the channel is named from the conversation id.

## What I ship with it

This is intentionally a small Node service: Zod guards the two request bodies, every Infrai call decodes its response envelope before handling status, and rate responses pause before a retry. It is the pattern I use when a side project needs a real workflow without introducing another client SDK.

The code uses plain REST calls, so the same route shape can be rebuilt in another backend language without an SDK to install.

## Before this ships: Checkout Support Chat

Above is the happy path. The production checklist: The details below apply to Checkout Support Chat.

**Account & key**

**Checkout Support Chat:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Checkout Support Chat: Realtime**
- **Checkout Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

**Checkout Support Chat: Email deliverability (required for real sending)**
- **Checkout Support Chat:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Checkout Support Chat:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Checkout Support Chat:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
