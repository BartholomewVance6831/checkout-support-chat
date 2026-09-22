import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, InfraiSupportApi } from "./infrai_support_api.js";
import { customerUpdate } from "./order_update.js";

const incomingMessage = z.object({
  kind: z.literal("customer_message"),
  conversationId: z.string().min(1),
  accountId: z.string().min(1),
  orderId: z.string().min(1),
  orderState: z.enum(["checkout", "fulfillment", "receipt", "delivered"]),
  message: z.string().min(1)
});
const visitorLeaving = z.object({
  kind: z.literal("visitor_left"),
  conversationId: z.string().min(1),
  accountId: z.string().min(1),
  email: z.string().email(),
  transcript: z.array(z.string().min(1)).min(1)
});
const supportRequest = z.discriminatedUnion("kind", [incomingMessage, visitorLeaving]);

const api = new InfraiSupportApi();

async function handleSupportRequest(input: unknown): Promise<{ status: number; body: unknown }> {
  const parsed = supportRequest.safeParse(input);
  if (!parsed.success) return { status: 400, body: { error: "Invalid support request." } };

  try {
    if (parsed.data.kind === "visitor_left") {
      await api.emailTranscript(
        parsed.data.email,
        `Your support chat ${parsed.data.conversationId}`,
        parsed.data.transcript.join("\n")
      );
      return { status: 202, body: { emailed: true } };
    }

    const channel = `support-${parsed.data.conversationId}`;
    await api.createConversation(channel);
    const reply = customerUpdate(parsed.data.orderState, parsed.data.orderId);
    await api.publishCustomerUpdate(channel, "support.customer_message", {
      message_id: `${parsed.data.conversationId}-${parsed.data.orderId}`,
      customer_message: parsed.data.message,
      order_id: parsed.data.orderId,
      order_state: parsed.data.orderState,
      reply
    }, parsed.data.accountId);
    return { status: 201, body: { channel, reply } };
  } catch (error) {
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 502;
    return { status, body: { error: "Unable to process this support request." } };
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/support/events") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Invalid JSON." })); return; }
  const result = await handleSupportRequest(input);
  response.writeHead(result.status, { "Content-Type": "application/json" }).end(JSON.stringify(result.body));
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("Support desk listening on http://localhost:3000");
});

export { handleSupportRequest };
