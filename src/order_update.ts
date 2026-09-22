export type OrderState = "checkout" | "fulfillment" | "receipt" | "delivered";

export function customerUpdate(state: OrderState, orderId: string): string {
  const updates: Record<OrderState, string> = {
    checkout: `Order ${orderId} is still in checkout. Confirm payment before we release it.`,
    fulfillment: `Order ${orderId} is being packed. I will share the shipment update here.`,
    receipt: `Order ${orderId} has a receipt ready. Check the email address used at checkout.`,
    delivered: `Order ${orderId} is marked delivered. Reply here if anything is missing.`
  };
  return updates[state];
}
