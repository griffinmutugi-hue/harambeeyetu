import assert from "node:assert/strict";
import test from "node:test";
import { campaignLifecycle, daysUntil } from "./campaigns";

test("an active campaign without a deadline stays open indefinitely", () => {
  const lifecycle = campaignLifecycle(null, "active");

  assert.equal(daysUntil(null), 0);
  assert.equal(lifecycle.isExpired, false);
  assert.equal(lifecycle.isAcceptingDonations, true);
  assert.equal(lifecycle.decisionDeadline, null);
  assert.equal(lifecycle.canExtend, false);
});