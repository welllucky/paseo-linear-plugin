import assert from "node:assert/strict";
import { test } from "node:test";
import contribute from "../index.server";
import { workspaceLinks } from "../shared/links";

test("the server entry registers the host-scoped workspace links and the RPC handlers", () => {
  const registered: unknown[] = [];
  const handled: string[] = [];
  const server = {
    registerSettings: (definition: unknown) => {
      registered.push(definition);
      return { read: async () => ({ status: "ready" }), subscribe: () => () => {} };
    },
    handle: (contract: { name: string }) => void handled.push(contract.name),
  };
  const cleanup = contribute(server as never);
  assert.deepEqual(registered, [workspaceLinks]);
  assert.ok(handled.includes("linear-dashboard.catalog"));
  assert.ok(handled.includes("linear-dashboard.token.save"));
  assert.ok(handled.every((name) => name.startsWith("linear-dashboard.")));
  assert.equal(typeof cleanup, "function");
});
