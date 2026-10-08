import type { DashboardSummary } from "./dashboard";

export interface RawIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  updatedAt: string;
  state: { name: string; type: string };
  assignee: { name: string } | null;
  team?: { name: string } | null;
  project?: { name: string } | null;
}

const RECENT_LIMIT = 25;
const UNASSIGNED = "Unassigned";

function tally<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = key(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function byCountDesc(a: { name: string; count: number }, b: { name: string; count: number }) {
  return b.count - a.count || a.name.localeCompare(b.name);
}

export function summarize(
  issues: RawIssue[],
  options: { truncated: boolean; now: Date },
): DashboardSummary {
  const stateTypes = new Map(issues.map((issue) => [issue.state.name, issue.state.type]));
  const byState = [...tally(issues, (issue) => issue.state.name)]
    .map(([name, count]) => ({ name, count, type: stateTypes.get(name) ?? "unknown" }))
    .sort(byCountDesc);

  // Linear priority 0 means "No priority"; 1 (Urgent) is the most pressing, so it sorts first.
  const priorityRank = new Map<string, number>();
  for (const issue of issues) {
    priorityRank.set(issue.priorityLabel, issue.priority === 0 ? 5 : issue.priority);
  }
  const byPriority = [...tally(issues, (issue) => issue.priorityLabel)]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (priorityRank.get(a.name) ?? 9) - (priorityRank.get(b.name) ?? 9));

  const byAssignee = [...tally(issues, (issue) => issue.assignee?.name ?? UNASSIGNED)]
    .map(([name, count]) => ({ name, count }))
    .sort(byCountDesc);

  const recent = [...issues]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT)
    .map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      state: issue.state.name,
      priority: issue.priorityLabel,
      assignee: issue.assignee?.name ?? null,
      team: issue.team?.name ?? null,
      project: issue.project?.name ?? null,
      updatedAt: issue.updatedAt,
    }));

  return {
    fetchedAt: options.now.toISOString(),
    total: issues.length,
    truncated: options.truncated,
    byState,
    byPriority,
    byAssignee,
    recent,
  };
}
