import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKenyanMobile } from "./campaigns";

test("accepts Kenyan mobile numbers starting with +254 and 07", () => {
  assert.equal(normalizeKenyanMobile("+254711123456"), "+254711123456");
  assert.equal(normalizeKenyanMobile("0711123456"), "+254711123456");
});

test("normalizes the displayed phone format and rejects invalid prefixes or lengths", () => {
  assert.equal(normalizeKenyanMobile("+254 711 123 456"), "+254711123456");
  assert.equal(normalizeKenyanMobile("071112345"), null);
  assert.equal(normalizeKenyanMobile("0111123456"), null);
});