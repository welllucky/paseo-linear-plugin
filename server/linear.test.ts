import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIssueFilter,
  fetchCatalog,
  fetchIssue,
  fetchOpenIssues,
  fetchViewer,
  LinearApiError,
  PAGE_LIMIT,
  updateIssue,
} from "./linear";
import {
  complexityLimitedFetch,
  detail,
  estimateComplexity,
  LINEAR_COMPLEXITY_LIMIT,
  mockFetch,
} from "./test-helpers";

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

// The single query the catalog used to send. Real Linear answered it with HTTP 400 "Query too complex".
const MONOLITHIC_CATALOG_QUERY = `
  query PaseoLinearCatalog {
    teams(first: 100) {
      nodes {
        id key name
        states(first: 100) { nodes { id name type } }
        members(first: 100) { nodes { id name } }
      }
    }
    projects(first: 100) {
      nodes { id name teams(first: 100) { nodes { id } } }
    }
  }
`;

const page = <T>(nodes: T[], next: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage: next !== null, endCursor: next },
});

test("the old single catalog query is too complex for Linear and gets HTTP 400", async () => {
  assert.ok(estimateComplexity(MONOLITHIC_CATALOG_QUERY) > LINEAR_COMPLEXITY_LIMIT);
  const { request } = complexityLimitedFetch(() => ({ data: {} }));
  const response = await request("https://api.linear.app/graphql", {
    method: "POST",
    body: JSON.stringify({ query: MONOLITHIC_CATALOG_QUERY, variables: {} }),
  });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Query too complex/);
});

test("fetchCatalog splits into small queries that Linear accepts", async () => {
  const { calls, request } = complexityLimitedFetch((call) => {
    if (call.query.includes("PaseoLinearTeams(") || call.query.includes("PaseoLinearTeams ")) {
      return {
        data: {
          teams: page([
            { id: "t2", key: "OPS", name: "Ops" },
            { id: "t1", key: "ENG", name: "Eng" },
          ]),
        },
      };
    }
    return {
      data: {
        team: {
          states: page([{ id: `s-${call.variables.id}`, name: "Todo", type: "unstarted" }]),
          members: page([
            { id: "u2", name: "Zed" },
            { id: "u1", name: "Ana" },
          ]),
          projects: page([{ id: "shared", name: "Shared" }]),
        },
      },
    };
  });
  const catalog = await fetchCatalog({ apiKey: "lin_api_secret", request });

  assert.ok(calls.length > 1);
  for (const call of calls) {
    assert.ok(estimateComplexity(call.query) <= LINEAR_COMPLEXITY_LIMIT, call.query);
    assert.ok(!JSON.stringify(call).includes("lin_api_secret"));
  }
  assert.equal(calls.filter((call) => call.query.includes("PaseoLinearTeamDetail")).length, 2);
  assert.deepEqual(
    catalog.teams.map((team) => [team.id, team.key, team.members.map((m) => m.name)]),
    [
      ["t1", "ENG", ["Ana", "Zed"]],
      ["t2", "OPS", ["Ana", "Zed"]],
    ],
  );
  assert.deepEqual(catalog.teams[0].states, [{ id: "s-t1", name: "Todo", type: "unstarted" }]);
  assert.equal(catalog.projects.length, 1);
  assert.deepEqual(catalog.projects[0].teamIds.sort(), ["t1", "t2"]);
});

test("fetchCatalog follows pagination for teams and for each team connection", async () => {
  const { calls, request } = mockFetch((call) => {
    const { query, variables } = call;
    if (query.includes("PaseoLinearTeams")) {
      return {
        data: {
          teams: variables.after
            ? page([{ id: "t2", key: "OPS", name: "Ops" }])
            : page([{ id: "t1", key: "ENG", name: "Eng" }], "teams-1"),
        },
      };
    }
    if (query.includes("PaseoLinearTeamDetail")) {
      return {
        data: {
          team: {
            states: page([{ id: "s1", name: "Todo", type: "unstarted" }]),
            members: variables.id === "t1" ? page([{ id: "u1", name: "Ana" }], "m-1") : page([]),
            projects: page([], variables.id === "t1" ? "p-1" : null),
          },
        },
      };
    }
    if (query.includes("PaseoLinearTeam_members")) {
      return { data: { team: { members: page([{ id: "u2", name: "Bia" }]) } } };
    }
    if (query.includes("PaseoLinearTeam_projects")) {
      assert.equal(variables.after, "p-1");
      return { data: { team: { projects: page([{ id: "p9", name: "Late" }]) } } };
    }
    throw new Error(`unexpected query ${query}`);
  });
  const catalog = await fetchCatalog({ apiKey: "k", request });
  assert.deepEqual(
    catalog.teams.map((team) => team.id),
    ["t1", "t2"],
  );
  assert.deepEqual(
    catalog.teams[0].members.map((member) => member.name),
    ["Ana", "Bia"],
  );
  assert.deepEqual(catalog.projects, [{ id: "p9", name: "Late", teamIds: ["t1"] }]);
  const memberPage = calls.find((call) => call.query.includes("PaseoLinearTeam_members"));
  assert.deepEqual(memberPage?.variables, { id: "t1", after: "m-1" });
});

test("fetchCatalog stops after PAGE_LIMIT pages of a connection", async () => {
  let teamPages = 0;
  const { request } = mockFetch(() => {
    teamPages += 1;
    return {
      data: { teams: page([{ id: `t${teamPages}`, key: "K", name: `T${teamPages}` }], "more") },
    };
  });
  const withNoDetail = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (body.query.includes("PaseoLinearTeamDetail")) {
      return new Response(
        JSON.stringify({
          data: { team: { states: page([]), members: page([]), projects: page([]) } },
        }),
      );
    }
    return request(url, init);
  }) as typeof fetch;
  const catalog = await fetchCatalog({ apiKey: "k", request: withNoDetail });
  assert.equal(catalog.teams.length, PAGE_LIMIT);
  assert.equal(teamPages, PAGE_LIMIT);
});
