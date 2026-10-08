import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { changeIssue, getCatalog, getDashboard, getIssue } from "./dashboard";
import { buildIssueFilter, fetchOpenIssues, LinearApiError, updateIssue } from "./linear";

type Call = { query: string; variables: Record<string, any>; auth: string | null };

function mockFetch(respond: (call: Call) => unknown, status = 200) {
  const calls: Call[] = [];
  const request = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const headers = init.headers as Record<string, string>;
    const call = {
      query: body.query,
      variables: body.variables,
      auth: headers.Authorization ?? null,
    };
    calls.push(call);
    return new Response(JSON.stringify(respond(call)), { status });
  }) as typeof fetch;
  return { calls, request };
}

const detail = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  identifier: "ENG-1",
  title: "Title",
  description: "Body",
  url: "https://linear.app/x/issue/ENG-1",
  priority: 2,
  priorityLabel: "High",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  dueDate: null,
  state: { id: "s1", name: "Todo", type: "unstarted" },
  assignee: null,
  team: { id: "t1", key: "ENG", name: "Eng" },
  project: null,
  comments: {
    nodes: [{ id: "c1", body: "hi", createdAt: "2026-10-02T00:00:00.000Z", user: null }],
    pageInfo: { hasNextPage: false },
  },
  attachments: {
    nodes: [
      { id: "a1", title: "Spec", subtitle: null, sourceType: "figma", url: "https://figma.com/x" },
      { id: "a2", title: null, subtitle: null, sourceType: null, url: "javascript:alert(1)" },
    ],
    pageInfo: { hasNextPage: true },
  },
  ...over,
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.LINEAR_API_KEY;
});

test("filter adds team and project but always excludes closed states", () => {
  assert.deepEqual(buildIssueFilter({ teamId: "t", projectId: "p" }), {
    state: { type: { nin: ["completed", "canceled"] } },
    team: { id: { eq: "t" } },
    project: { id: { eq: "p" } },
  });
});

test("fetchOpenIssues sends the filter and paginates", async () => {
  let page = 0;
  const { calls, request } = mockFetch(() => ({
    data: {
      issues: {
        nodes: [],
        pageInfo: { hasNextPage: page++ === 0, endCursor: "c1" },
      },
    },
  }));
  const out = await fetchOpenIssues({ apiKey: "k", request, filter: { teamId: "t1" } });
  assert.equal(out.truncated, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].variables.after, "c1");
  assert.deepEqual(calls[0].variables.filter.team, { id: { eq: "t1" } });
  assert.equal(calls[0].auth, "k");
});

test("updateIssue sends only the changed fields and unassigns with null", async () => {
  const { calls, request } = mockFetch(() => ({
    data: { issueUpdate: { success: true, issue: detail() } },
  }));
  const issue = await updateIssue({
    apiKey: "k",
    request,
    update: { id: "i1", title: "  New  ", assigneeId: null, priority: 1 },
  });
  assert.match(calls[0].query, /issueUpdate/);
  assert.deepEqual(calls[0].variables, {
    id: "i1",
    input: { title: "New", priority: 1, assigneeId: null },
  });
  assert.equal(issue.attachments[0].url, "https://figma.com/x");
  assert.equal(issue.attachments[1].url, null);
  assert.equal(issue.attachments[1].title, "javascript:alert(1)");
  assert.equal(issue.attachmentsTruncated, true);
  assert.equal(issue.comments[0].author, null);
});

test("updateIssue rejects an empty title and unsuccessful payloads", async () => {
  const { calls, request } = mockFetch(() => ({
    data: { issueUpdate: { success: false, issue: null } },
  }));
  await assert.rejects(
    updateIssue({ apiKey: "k", request, update: { id: "i", title: "  " } }),
    /cannot be empty/,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    updateIssue({ apiKey: "k", request, update: { id: "i", stateId: "s" } }),
    LinearApiError,
  );
});

test("handlers report not_configured without calling Linear", async () => {
  const { calls, request } = mockFetch(() => ({}));
  globalThis.fetch = request;
  assert.deepEqual(await getDashboard({}), { status: "not_configured" });
  assert.deepEqual(await changeIssue({ id: "i", priority: 1 }), { status: "not_configured" });
  assert.equal(calls.length, 0);
});

test("handlers return catalog and issue detail", async () => {
  process.env.LINEAR_API_KEY = "lin_api_secret";
  const { request } = mockFetch((call) =>
    call.query.includes("PaseoLinearCatalog")
      ? {
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
        }
      : { data: { issue: detail() } },
  );
  globalThis.fetch = request;
  const catalog = await getCatalog();
  assert.equal(catalog.status, "ready");
  if (catalog.status === "ready") {
    assert.deepEqual(
      catalog.data.teams[0].members.map((m) => m.name),
      ["Ana", "Zed"],
    );
    assert.deepEqual(catalog.data.projects[0].teamIds, ["t1"]);
  }
  const issue = await getIssue({ id: "ENG-1" });
  assert.equal(issue.status, "ready");
});

test("errors are clear and never contain the key", async () => {
  process.env.LINEAR_API_KEY = "lin_api_secret";
  globalThis.fetch = mockFetch(() => ({}), 401).request;
  const rejected = await changeIssue({ id: "i", priority: 1 });
  assert.deepEqual(rejected, { status: "error", message: "Linear rejected LINEAR_API_KEY" });

  globalThis.fetch = mockFetch(() => ({ errors: [{ message: "Invalid stateId" }] })).request;
  const gql = await changeIssue({ id: "i", stateId: "bad" });
  assert.deepEqual(gql, { status: "error", message: "Invalid stateId" });

  globalThis.fetch = (async () => {
    throw new Error("socket lin_api_secret");
  }) as typeof fetch;
  const net = await getIssue({ id: "i" });
  assert.equal(net.status, "error");
  assert.ok(!JSON.stringify(net).includes("lin_api_secret"));
});
