import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize, type RawIssue } from "./summarize";

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
      issue(2, { priority: 1, priorityLabel: "Urgent", state: { name: "In Progress", type: "started" } }),
      issue(3, { priority: 0, priorityLabel: "No priority", assignee: { name: "Ana" } }),
    ],
    { truncated: false, now: new Date("2026-10-07T00:00:00Z") },
  );
  assert.equal(s.total, 3);
  assert.deepEqual(s.byState.map((r) => [r.name, r.count]), [["Todo", 2], ["In Progress", 1]]);
  assert.deepEqual(s.byPriority.map((r) => r.name), ["Urgent", "Medium", "No priority"]);
  assert.deepEqual(s.byAssignee, [{ name: "Ana", count: 2 }, { name: "Unassigned", count: 1 }]);
  assert.deepEqual(s.recent.map((r) => r.identifier), ["ENG-3", "ENG-2", "ENG-1"]);
  assert.equal(s.fetchedAt, "2026-10-07T00:00:00.000Z");
});

test("handles an empty list and keeps the truncated flag", () => {
  const s = summarize([], { truncated: true, now: new Date(0) });
  assert.equal(s.total, 0);
  assert.equal(s.truncated, true);
  assert.deepEqual(s.byState, []);
});
