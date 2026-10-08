import assert from "node:assert/strict";
import { test } from "node:test";
import { issueUpdate } from "./dashboard";
import { safeExternalUrl } from "./urls";

test("safeExternalUrl allows only http and https", () => {
  assert.equal(safeExternalUrl("https://a.com/x"), "https://a.com/x");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("file:///etc/passwd"), null);
  assert.equal(safeExternalUrl("not a url"), null);
  assert.equal(safeExternalUrl(null), null);
});

test("issueUpdate needs at least one change and a valid priority", () => {
  assert.equal(issueUpdate.safeParse({ id: "i" }).success, false);
  assert.equal(issueUpdate.safeParse({ id: "i", priority: 5 }).success, false);
  assert.equal(issueUpdate.safeParse({ id: "i", assigneeId: null }).success, true);
});
