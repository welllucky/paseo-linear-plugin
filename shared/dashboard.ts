import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const countRow = z.object({ name: z.string(), count: z.number() });

export const issueRow = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.string(),
  state: z.string(),
  priority: z.string(),
  assignee: z.string().nullable(),
  team: z.string().nullable(),
  project: z.string().nullable(),
  updatedAt: z.string(),
});

export const dashboardSummary = z.object({
  fetchedAt: z.string(),
  total: z.number(),
  truncated: z.boolean(),
  byState: z.array(countRow.extend({ type: z.string() })),
  byPriority: z.array(countRow),
  byAssignee: z.array(countRow),
  recent: z.array(issueRow),
});

export const issueFilter = z.object({
  teamId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

/** Every RPC answers with one of these three shapes; the client never sees a thrown error. */
function result<T extends z.ZodType>(ready: T) {
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("ready"), data: ready }),
    z.object({ status: z.literal("not_configured") }),
    z.object({ status: z.literal("error"), message: z.string() }),
  ]);
}

export const catalog = z.object({
  teams: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      states: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
      members: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
  projects: z.array(z.object({ id: z.string(), name: z.string(), teamIds: z.array(z.string()) })),
});

export const issueDetail = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  priority: z.number(),
  priorityLabel: z.string(),
  state: z.object({ id: z.string(), name: z.string(), type: z.string() }),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  team: z.object({ id: z.string(), key: z.string(), name: z.string() }).nullable(),
  project: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dueDate: z.string().nullable(),
  comments: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      author: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  commentsTruncated: z.boolean(),
  attachments: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string().nullable(),
      source: z.string().nullable(),
      /** Null when the stored URL is not http(s); such attachments are listed but cannot be opened. */
      url: z.string().nullable(),
    }),
  ),
  attachmentsTruncated: z.boolean(),
});

export const issueUpdate = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    stateId: z.string().min(1).optional(),
    priority: z.number().int().min(0).max(4).optional(),
    /** Null unassigns. */
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => key !== "id" && value[key as keyof typeof value] !== undefined,
      ),
    { message: "Nothing to update" },
  );

export const PRIORITIES = [
  { value: 0, label: "No priority" },
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Low" },
] as const;

export type DashboardSummary = z.infer<typeof dashboardSummary>;
export type IssueRow = z.infer<typeof issueRow>;
export type Catalog = z.infer<typeof catalog>;
export type IssueDetail = z.infer<typeof issueDetail>;
export type IssueFilter = z.infer<typeof issueFilter>;
export type IssueUpdate = z.infer<typeof issueUpdate>;

export const getDashboardRpc = defineRpc({
  name: "linear-dashboard.summary",
  input: issueFilter,
  output: result(dashboardSummary),
});

export const getCatalogRpc = defineRpc({
  name: "linear-dashboard.catalog",
  input: z.object({}),
  output: result(catalog),
});

export const getIssueRpc = defineRpc({
  name: "linear-dashboard.issue",
  input: z.object({ id: z.string().min(1) }),
  output: result(issueDetail),
});

export const updateIssueRpc = defineRpc({
  name: "linear-dashboard.update",
  input: issueUpdate,
  output: result(issueDetail),
});
