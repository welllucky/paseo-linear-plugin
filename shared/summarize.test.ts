import assert from "node:assert/strict";
import { test } from "node:test";
import { groupIssuesByState, type RawIssue, summarize } from "./summarize";

function issue(n: number, over: Partial<RawIssue> = {}): RawIssue {
  return {
    id: `id${n}`,
    identifier: `ENG-${n}`,
    title: `Issue ${n}`,
    url: `https://linear.app/x/issue/ENG-${n}`,
    priority: 3,
    priorityLabel: "Medium",
    updatedAt: `2026-10-0${n}T00:00:00.000Z`,
    state: { name: "Todo", type: "unstarted" },
    assignee: null,
    ...over,
  };
}

test("counts by state, priority and assignee", () => {
  const s = summarize(
    [
      issue(1, { assignee: { name: "Ana" } }),
      issue(2, {
        priority: 1,
        priorityLabel: "Urgent",
        state: { name: "In Progress", type: "started" },
      }),
      issue(3, { priority: 0, priorityLabel: "No priority", assignee: { name: "Ana" } }),
    ],
    { truncated: false, now: new Date("2026-10-07T00:00:00Z") },
  );
  assert.equal(s.total, 3);
  assert.deepEqual(
    s.byState.map((r) => [r.name, r.count]),
    [
      ["Todo", 2],
      ["In Progress", 1],
    ],
  );
  assert.deepEqual(
    s.byPriority.map((r) => r.name),
    ["Urgent", "Medium", "No priority"],
  );
  assert.deepEqual(s.byAssignee, [
    { name: "Ana", count: 2 },
    { name: "Unassigned", count: 1 },
  ]);
  assert.deepEqual(
    s.recent.map((r) => r.identifier),
    ["ENG-3", "ENG-2", "ENG-1"],
  );
  assert.equal(s.fetchedAt, "2026-10-07T00:00:00.000Z");
});

test("handles an empty list and keeps the truncated flag", () => {
  const s = summarize([], { truncated: true, now: new Date(0) });
  assert.equal(s.total, 0);
  assert.equal(s.truncated, true);
  assert.deepEqual(s.byState, []);
});

test("groups issues by summary state order and preserves issue order", () => {
  const summary = summarize(
    [
      issue(1, { state: { name: "Todo", type: "unstarted" } }),
      issue(2, { state: { name: "In Progress", type: "started" } }),
      issue(3, { state: { name: "Todo", type: "unstarted" } }),
    ],
    { truncated: false, now: new Date(0) },
  );
  const groups = groupIssuesByState(summary.recent, summary.byState);
  assert.deepEqual(
    groups.map((group) => [group.name, group.type, group.issues.map((item) => item.identifier)]),
    [
      ["Todo", "unstarted", ["ENG-3", "ENG-1"]],
      ["In Progress", "started", ["ENG-2"]],
    ],
  );
});

test("puts an unexpected state after the declared summary order", () => {
  const issues = [
    {
      id: "1",
      identifier: "ENG-1",
      title: "Issue 1",
      url: "https://linear.app/x/issue/ENG-1",
      state: "Other",
      priority: "Low",
      assignee: null,
      team: null,
      project: null,
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "2",
      identifier: "ENG-2",
      title: "Issue 2",
      url: "https://linear.app/x/issue/ENG-2",
      state: "Todo",
      priority: "Low",
      assignee: null,
      team: null,
      project: null,
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
  ];
  const groups = groupIssuesByState(issues, [{ name: "Todo", type: "unstarted" }]);
  assert.deepEqual(
    groups.map((group) => group.name),
    ["Todo", "Other"],
  );
  assert.equal(groups[1]?.type, "unknown");
});
