import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIssueFilter,
  fetchIssue,
  fetchOpenIssues,
  fetchViewer,
  LinearApiError,
  updateIssue,
} from "./linear";
import { detail, mockFetch } from "./test-helpers";

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

test("fetchIssue turns history into readable activity, newest first", async () => {
  const { request } = mockFetch(() => ({
    data: {
      issue: detail({
        history: {
          nodes: [
            {
              id: "h1",
              createdAt: "2026-10-02T10:00:00.000Z",
              actor: { name: "Ana" },
              fromState: { name: "Todo" },
              toState: { name: "In Progress" },
            },
            {
              id: "h0",
              createdAt: "2026-10-03T10:00:00.000Z",
              actor: null,
              fromPriority: 2,
              toPriority: 1,
              toAssignee: { name: "Zed" },
            },
            { id: "noise", createdAt: "2026-10-04T10:00:00.000Z" },
          ],
        },
      }),
    },
  }));
  const issue = await fetchIssue({ apiKey: "k", request, id: "ENG-1" });
  assert.deepEqual(
    issue.activity.map((entry) => [entry.id, entry.actor, entry.summary]),
    [
      ["h0", null, "Priority High → Urgent; Assigned to Zed"],
      ["h1", "Ana", "Status Todo → In Progress"],
    ],
  );
  assert.equal(issue.description, "Body");
  assert.equal(issue.comments.length, 1);
});

test("fetchViewer names whose key it is", async () => {
  const { calls, request } = mockFetch(() => ({ data: { viewer: { name: "Ana" } } }));
  assert.deepEqual(await fetchViewer({ apiKey: "k", request }), { viewer: "Ana" });
  assert.match(calls[0].query, /viewer/);
});
