import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { createCredentialStore } from "./credentials";
import { createHandlers } from "./dashboard";
import { detail, mockFetch } from "./test-helpers";

const SECRET = "lin_api_secret";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "linear-handlers-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function setup(env: NodeJS.ProcessEnv, request: typeof fetch) {
  const credentials = createCredentialStore({ path: join(dir, "token"), env });
  return { credentials, ...createHandlers({ credentials, request }) };
}

const catalogResponse = {
  data: {
    teams: {
      nodes: [
        {
          id: "t1",
          key: "ENG",
          name: "Eng",
          states: { nodes: [{ id: "s1", name: "Todo", type: "unstarted" }] },
          members: {
            nodes: [
              { id: "u2", name: "Zed" },
              { id: "u1", name: "Ana" },
            ],
          },
        },
      ],
    },
    projects: { nodes: [{ id: "p1", name: "Proj", teams: { nodes: [{ id: "t1" }] } }] },
  },
};

test("handlers report not_configured without calling Linear", async () => {
  const { calls, request } = mockFetch(() => ({}));
  const h = setup({}, request);
  assert.deepEqual(await h.getDashboard({}), { status: "not_configured" });
  assert.deepEqual(await h.changeIssue({ id: "i", priority: 1 }), { status: "not_configured" });
  assert.deepEqual(await h.checkConnection(), { status: "not_configured" });
  assert.equal(calls.length, 0);
});

test("handlers return catalog and issue detail", async () => {
  const { request } = mockFetch((call) =>
    call.query.includes("PaseoLinearCatalog") ? catalogResponse : { data: { issue: detail() } },
  );
  const h = setup({ LINEAR_API_KEY: SECRET }, request);
  const catalog = await h.getCatalog();
  assert.equal(catalog.status, "ready");
  if (catalog.status === "ready") {
    assert.deepEqual(
      catalog.data.teams[0].members.map((member) => member.name),
      ["Ana", "Zed"],
    );
    assert.deepEqual(catalog.data.projects[0].teamIds, ["t1"]);
  }
  const issue = await h.getIssue({ id: "ENG-1" });
  assert.equal(issue.status, "ready");
  if (issue.status === "ready") {
    assert.equal(issue.data.description, "Body");
    assert.equal(issue.data.comments[0].body, "hi");
    assert.equal(issue.data.attachments[0].title, "Spec");
  }
});

test("changeIssue sends status, priority, assignee, title and description changes", async () => {
  const { calls, request } = mockFetch(() => ({
    data: { issueUpdate: { success: true, issue: detail({ priority: 1 }) } },
  }));
  const h = setup({ LINEAR_API_KEY: SECRET }, request);
  const outcome = await h.changeIssue({
    id: "i1",
    stateId: "s2",
    priority: 1,
    assigneeId: "u1",
    title: "T",
    description: "D",
  });
  assert.equal(outcome.status, "ready");
  assert.deepEqual(calls[0].variables, {
    id: "i1",
    input: { stateId: "s2", priority: 1, assigneeId: "u1", title: "T", description: "D" },
  });
  assert.equal(calls[0].auth, SECRET);
});

test("save, status and clear never return the token, and the saved key is used for requests", async () => {
  const { calls, request } = mockFetch(() => ({ data: { viewer: { name: "Ana" } } }));
  const h = setup({ LINEAR_API_KEY: "lin_api_from_env" }, request);

  assert.deepEqual(await h.getTokenStatus(), {
    status: "ready",
    data: { configured: true, source: "environment" },
  });

  const saved = await h.saveToken({ token: ` ${SECRET} ` });
  assert.deepEqual(saved, { status: "ready", data: { configured: true, source: "settings" } });
  assert.ok(!JSON.stringify(saved).includes(SECRET));

  const checked = await h.checkConnection();
  assert.deepEqual(checked, { status: "ready", data: { viewer: "Ana" } });
  assert.equal(calls[0].auth, SECRET);

  const cleared = await h.clearToken();
  assert.deepEqual(cleared, { status: "ready", data: { configured: true, source: "environment" } });
  await h.checkConnection();
  assert.equal(calls[1].auth, "lin_api_from_env");
});

test("clearing the saved key without a fallback leaves nothing configured", async () => {
  const h = setup({}, mockFetch(() => ({})).request);
  await h.saveToken({ token: SECRET });
  assert.deepEqual(await h.clearToken(), {
    status: "ready",
    data: { configured: false, source: "none" },
  });
  assert.deepEqual(await h.getDashboard({}), { status: "not_configured" });
});

test("saving a bad token is an error that does not echo it and keeps the old key", async () => {
  const h = setup({}, mockFetch(() => ({})).request);
  await h.saveToken({ token: SECRET });
  const bad = await h.saveToken({ token: "lin api secret" });
  assert.equal(bad.status, "error");
  assert.ok(!JSON.stringify(bad).includes("secret"));
  assert.deepEqual(await h.getTokenStatus(), {
    status: "ready",
    data: { configured: true, source: "settings" },
  });
  assert.equal((await h.saveToken({ token: "  " })).status, "error");
});

test("errors are clear and never contain the key", async () => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  try {
    let h = setup({ LINEAR_API_KEY: SECRET }, mockFetch(() => ({}), 401).request);
    assert.deepEqual(await h.changeIssue({ id: "i", priority: 1 }), {
      status: "error",
      message: "Linear rejected the API key. Check it in plugin settings",
    });

    h = setup(
      { LINEAR_API_KEY: SECRET },
      mockFetch(() => ({ errors: [{ message: `Invalid stateId for ${SECRET}` }] })).request,
    );
    assert.deepEqual(await h.changeIssue({ id: "i", stateId: "bad" }), {
      status: "error",
      message: "Invalid stateId for [redacted]",
    });

    h = setup({ LINEAR_API_KEY: SECRET }, (async () => {
      throw new Error(`socket ${SECRET}`);
    }) as typeof fetch);
    const net = await h.getIssue({ id: "i" });
    assert.equal(net.status, "error");
    assert.ok(!JSON.stringify(net).includes(SECRET));
  } finally {
    console.error = original;
  }
  assert.ok(!JSON.stringify(errors).includes(SECRET));
});
