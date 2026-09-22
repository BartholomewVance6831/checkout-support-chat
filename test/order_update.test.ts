import assert from "node:assert/strict";
import test from "node:test";
import { customerUpdate } from "../src/order_update.js";

test("fulfillment orders receive a packing update", () => {
  assert.equal(
    customerUpdate("fulfillment", "ord_42"),
    "Order ord_42 is being packed. I will share the shipment update here."
  );
});
