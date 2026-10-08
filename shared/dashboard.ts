import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const countRow = z.object({ name: z.string(), count: z.number() });

const recentIssue = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.string(),
  state: z.string(),
  priority: z.string(),
  assignee: z.string().nullable(),
  updatedAt: z.string(),
});

export const dashboardSummary = z.object({
  fetchedAt: z.string(),
  total: z.number(),
  truncated: z.boolean(),
  byState: z.array(countRow.extend({ type: z.string() })),
  byPriority: z.array(countRow),
  byAssignee: z.array(countRow),
  recent: z.array(recentIssue),
});

export const dashboardResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), summary: dashboardSummary }),
  z.object({ status: z.literal("not_configured") }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);

export type DashboardSummary = z.infer<typeof dashboardSummary>;
export type DashboardResult = z.infer<typeof dashboardResult>;

export const getDashboardRpc = defineRpc({
  name: "linear-dashboard.summary",
  input: z.object({}),
  output: dashboardResult,
});
