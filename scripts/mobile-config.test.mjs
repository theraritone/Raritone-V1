import test from "node:test";
import assert from "node:assert/strict";
import { validateMobileApiBaseUrl } from "./mobile-config.mjs";

test("accepts an HTTPS origin", () => {
  assert.deepEqual(validateMobileApiBaseUrl("https://api.example.test"), {
    ok: true,
    origin: "https://api.example.test",
  });
  assert.equal(validateMobileApiBaseUrl("https://api.example.test/").ok, true);
});

test("rejects missing and non-HTTPS values", () => {
  for (const value of [undefined, "", "http://api.example.test", "not a url"]) {
    assert.equal(validateMobileApiBaseUrl(value).ok, false, String(value));
  }
});

test("rejects credentials, query, fragment, and paths", () => {
  for (const value of [
    "https://user:pass@api.example.test",
    "https://api.example.test?tenant=one",
    "https://api.example.test#native",
    "https://api.example.test/v1",
  ]) {
    assert.equal(validateMobileApiBaseUrl(value).ok, false, value);
  }
});
