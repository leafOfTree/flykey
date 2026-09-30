import assert from "node:assert/strict";
import test from "node:test";
import { getSiteKey, isSiteEnabled, normalizeDisabledSites } from "../common/site-settings.js";

test("site keys use lowercase hostnames and reject unsupported pages", () => {
  assert.equal(getSiteKey("https://Docs.Example.com/path?q=1"), "docs.example.com");
  assert.equal(getSiteKey("http://localhost:4173/"), "localhost");
  assert.equal(getSiteKey("chrome://extensions"), "");
  assert.equal(getSiteKey("not a URL"), "");
});

test("disabled site settings are normalized and applied per hostname", () => {
  assert.deepEqual(normalizeDisabledSites(["Example.com", "example.com", "", null]), ["example.com"]);
  assert.equal(isSiteEnabled(["example.com"], "example.com"), false);
  assert.equal(isSiteEnabled(["example.com"], "docs.example.com"), true);
  assert.equal(isSiteEnabled([], "example.com"), true);
});
