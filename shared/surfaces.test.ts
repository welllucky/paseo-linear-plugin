import assert from "node:assert/strict";
import { test } from "node:test";
import { describeTokenStatus } from "./dashboard";
import { DASHBOARD_PANEL, DASHBOARD_SCREEN, SETTINGS_SCREEN } from "./surfaces";

test("the panel is registered for the workspace and the right-side Explorer", () => {
  assert.equal(DASHBOARD_PANEL.context, "workspace");
  assert.deepEqual([...DASHBOARD_PANEL.locations], ["workspace", "explorer"]);
});

test("the full screen and the settings screen keep distinct ids", () => {
  assert.equal(DASHBOARD_SCREEN.id, "dashboard");
  assert.equal(SETTINGS_SCREEN.id, "settings");
});

test("token status text says where the key comes from without exposing it", () => {
  assert.match(describeTokenStatus({ configured: true, source: "settings" }), /saved/);
  assert.match(describeTokenStatus({ configured: true, source: "environment" }), /LINEAR_API_KEY/);
  assert.equal(describeTokenStatus({ configured: false, source: "none" }), "No key is set.");
});
