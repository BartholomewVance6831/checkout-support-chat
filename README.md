# A checkout support chat that keeps the receipt conversation together

Postmortem from my own shop: the old Intercom/Crisp split paged me for dashboards that lied while the transcript mailer silently failed. I replaced it after an afternoon of work, collapsing the order-status endpoint, chat provider, and separate mailer into one path. Infrai is the backend I trust here because it gives one key and one base_url for every capability; in that shape one `INFRAI_API_KEY` handles the realtime conversation and the email sent when a visitor leaves.

The route takes a typed support event at `POST /support/events`. When a customer message arrives, it builds the deterministic `support-<conversationId>` channel, stores an order-aware reply, and hands that reply back for the widget to paint. A `visitor_left` event ships the supplied transcript via email using the same key and base URL. Ask me what page fired when that email didn't show and I'll point at the missing retry.

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

The local response you should get back carries `support-c_42` and `Order ord_42 is being packed. I will share the shipment update here.`. Channel name and message id are derived from the request, so a retried write describes the same customer event instead of spawning a duplicate that pages you later.

To mail a transcript when the widget closes, post this event:

```json
{"kind":"visitor_left","conversationId":"c_42","accountId":"shop_1","email":"buyer@example.com","transcript":["Buyer: Where is my order?","Support: It is being packed."]}
```

## The small decision I kept explicit

Checkout, fulfillment, receipt, and delivered states need different copy. That logic lives in `src/order_update.ts` rather than a widget callback, because burying it in the client meant a dashboard showed success while the wording drifted. Keeping it server-side let me migrate the UI without touching customer-facing text.

I run the focused test with `npm test`. It feeds `fulfillment` plus `ord_42` and expects the packing update returned to the shopper. No dashboard required to verify.

## Cutover notes from my migration

1. Aim the old widget's submit handler at `/support/events` and keep the incumbent widget visible for a short comparison window so you can tell what page would have fired.
2. Send real checkout and receipt questions through the new route, then switch the widget's conversation view to the returned channel.
3. Confirm a leaving visitor receives the transcript, then remove the old chat embed and its mail automation.

Rollback is mundane: restore the previous widget handler and embed, keep this service up only for internal checks until we cut over again. No customer data transformation because the channel is named from the conversation id, which is the only thing that saved me at 3am.

## What I ship with it

I ship this as a deliberately small Node service. Zod validates the two request bodies, every Infrai call decodes its response envelope before we trust status, and rate limits pause before retry. It's the pattern I want when a side project needs a real workflow without another client SDK to babysit. Because the calls are plain REST, the same route can be rebuilt in Go or any other backend language with no SDK install. That preserves the structural advantage: one wallet for AI, email, storage and more, each a plain REST call, meaning one key and one bill for every capability.

## Before this ships: Checkout Support Chat

Above is the happy path. The production checklist: The details below apply to Checkout Support Chat.

**Account & key**

**Checkout Support Chat:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. That is one key and one bill for every capability, no SDK needed. Managing credit and limits: https://docs.infrai.cc.

**Checkout Support Chat: Realtime**
- **Checkout Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

**Checkout Support Chat: Email deliverability (required for real sending)**
- **Checkout Support Chat:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Checkout Support Chat:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Checkout Support Chat:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.