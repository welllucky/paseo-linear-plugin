import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { describeTokenStatus } from "./dashboard";
import { DASHBOARD_PANEL, DASHBOARD_SCREEN, panelLayout, SETTINGS_SCREEN } from "./surfaces";

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

test("panels always use the stacked layout and keep the other layout fields", () => {
  const wide = { compact: false, platform: "web" as const };
  assert.deepEqual(panelLayout(wide), { compact: true, platform: "web" });
  assert.equal(wide.compact, false);
  const narrow = { compact: true, platform: "ios" as const };
  assert.equal(panelLayout(narrow), narrow);
});

test("the client entry registers the panel, the screen and the settings screen", async () => {
  const source = await readFile(new URL("../index.client.tsx", import.meta.url), "utf8");
  assert.match(source, /addWorkspacePanel\(\{\s*\.\.\.DASHBOARD_PANEL/);
  assert.match(source, /locations: \[\.\.\.DASHBOARD_PANEL\.locations\]/);
  assert.match(source, /addSettingsScreen\(\{ \.\.\.SETTINGS_SCREEN/);
  assert.match(source, /addScreen\(\{ \.\.\.DASHBOARD_SCREEN/);
  // Only the panel reads workspace links; the global screen must not depend on a workspace.
  assert.match(source, /WorkspacePanel \{\.\.\.props\}/);
  const screen = /function DashboardScreen[\s\S]*?\n {2}\}/.exec(source)?.[0] ?? "";
  assert.ok(screen.includes("DashboardView") && !screen.includes("binding"));
});
