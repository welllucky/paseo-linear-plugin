import { z } from "zod";
import { PRIORITIES } from "../shared/dashboard";

export const HistorySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actor: z.object({ name: z.string() }).nullish(),
  fromState: z.object({ name: z.string() }).nullish(),
  toState: z.object({ name: z.string() }).nullish(),
  fromAssignee: z.object({ name: z.string() }).nullish(),
  toAssignee: z.object({ name: z.string() }).nullish(),
  fromPriority: z.number().nullish(),
  toPriority: z.number().nullish(),
  fromTitle: z.string().nullish(),
  toTitle: z.string().nullish(),
  updatedDescription: z.boolean().nullish(),
});

export type HistoryEntry = z.output<typeof HistorySchema>;

export const HISTORY_FIELDS = `history(first: 25) {
    nodes {
      id createdAt actor { name }
      fromState { name } toState { name }
      fromAssignee { name } toAssignee { name }
      fromPriority toPriority fromTitle toTitle updatedDescription
    }
  }`;

const priorityLabel = (value: number) =>
  PRIORITIES.find((priority) => priority.value === value)?.label ?? `P${value}`;

/** One readable line per change in a history entry. Entries with nothing recognizable give []. */
export function describeHistory(entry: HistoryEntry): string[] {
  const lines: string[] = [];
  if (entry.toState) {
    lines.push(
      entry.fromState
        ? `Status ${entry.fromState.name} → ${entry.toState.name}`
        : `Status set to ${entry.toState.name}`,
    );
  }
  if (entry.toPriority != null && entry.toPriority !== entry.fromPriority) {
    lines.push(
      entry.fromPriority != null
        ? `Priority ${priorityLabel(entry.fromPriority)} → ${priorityLabel(entry.toPriority)}`
        : `Priority set to ${priorityLabel(entry.toPriority)}`,
    );
  }
  if (entry.toAssignee) {
    lines.push(
      entry.fromAssignee
        ? `Assignee ${entry.fromAssignee.name} → ${entry.toAssignee.name}`
        : `Assigned to ${entry.toAssignee.name}`,
    );
  } else if (entry.fromAssignee) {
    lines.push(`Unassigned from ${entry.fromAssignee.name}`);
  }
  if (entry.toTitle) lines.push(`Title changed to "${entry.toTitle}"`);
  if (entry.updatedDescription) lines.push("Description edited");
  return lines;
}

export function toActivity(entries: readonly HistoryEntry[]) {
  const newestFirst = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return newestFirst.flatMap((entry) => {
    const lines = describeHistory(entry);
    return lines.length
      ? [
          {
            id: entry.id,
            createdAt: entry.createdAt,
            actor: entry.actor?.name ?? null,
            summary: lines.join("; "),
          },
        ]
      : [];
  });
}
