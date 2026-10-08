import { z } from "zod";
import type { Catalog, IssueDetail, IssueFilter, IssueUpdate } from "../shared/dashboard";
import type { RawIssue } from "../shared/summarize";
import { safeExternalUrl } from "../shared/urls";

const ENDPOINT = "https://api.linear.app/graphql";

export interface LinearOptions {
  apiKey: string;
  endpoint?: string;
  request?: typeof fetch;
}

export class LinearApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearApiError";
  }
}

function describeHttpFailure(status: number): string {
  if (status === 401 || status === 403) return "Linear rejected LINEAR_API_KEY";
  if (status === 429) return "Linear rate limit reached. Try again shortly";
  return `Linear API request failed with HTTP ${status}`;
}

const EnvelopeSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

/** One GraphQL round trip. The key goes only into the Authorization header. */
async function linearRequest<T extends z.ZodType>(
  options: LinearOptions,
  query: string,
  variables: Record<string, unknown>,
  schema: T,
): Promise<z.output<T>> {
  const request = options.request ?? fetch;
  const response = await request(options.endpoint ?? ENDPOINT, {
    method: "POST",
    headers: { Authorization: options.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new LinearApiError(describeHttpFailure(response.status));
  const body = EnvelopeSchema.parse(await response.json());
  if (body.errors?.length) {
    throw new LinearApiError(body.errors.map((error) => error.message).join("; "));
  }
  if (body.data == null) throw new LinearApiError("Linear returned no data");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) throw new LinearApiError("Linear returned data in an unexpected shape");
  return parsed.data;
}

// ---- Open issues (read-only) -------------------------------------------------------------

const IssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.string(),
  priority: z.number(),
  priorityLabel: z.string(),
  updatedAt: z.string(),
  state: z.object({ name: z.string(), type: z.string() }),
  assignee: z.object({ name: z.string() }).nullable(),
  team: z.object({ name: z.string() }).nullable(),
  project: z.object({ name: z.string() }).nullable(),
});

const IssuesDataSchema = z.object({
  issues: z.object({
    nodes: z.array(IssueSchema),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
  }),
});

const OPEN_ISSUES_QUERY = `
  query PaseoLinearDashboard($after: String, $filter: IssueFilter) {
    issues(first: 100, after: $after, orderBy: updatedAt, filter: $filter) {
      nodes {
        id identifier title url priority priorityLabel updatedAt
        state { name type }
        assignee { name }
        team { name }
        project { name }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PAGE_LIMIT = 5;

export function buildIssueFilter(filter: IssueFilter = {}): Record<string, unknown> {
  return {
    state: { type: { nin: ["completed", "canceled"] } },
    ...(filter.teamId ? { team: { id: { eq: filter.teamId } } } : {}),
    ...(filter.projectId ? { project: { id: { eq: filter.projectId } } } : {}),
  };
}

export async function fetchOpenIssues(
  options: LinearOptions & { filter?: IssueFilter },
): Promise<{ issues: RawIssue[]; truncated: boolean }> {
  const issues: RawIssue[] = [];
  let after: string | null = null;
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const data: z.output<typeof IssuesDataSchema> = await linearRequest(
      options,
      OPEN_ISSUES_QUERY,
      { after, filter: buildIssueFilter(options.filter) },
      IssuesDataSchema,
    );
    issues.push(...data.issues.nodes);
    const { hasNextPage, endCursor } = data.issues.pageInfo;
    if (!hasNextPage || !endCursor) return { issues, truncated: false };
    after = endCursor;
  }
  return { issues, truncated: true };
}

// ---- Teams and projects ------------------------------------------------------------------

const CatalogDataSchema = z.object({
  teams: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        key: z.string(),
        name: z.string(),
        states: z.object({
          nodes: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
        }),
        members: z.object({ nodes: z.array(z.object({ id: z.string(), name: z.string() })) }),
      }),
    ),
  }),
  projects: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        teams: z.object({ nodes: z.array(z.object({ id: z.string() })) }),
      }),
    ),
  }),
});

const CATALOG_QUERY = `
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

export async function fetchCatalog(options: LinearOptions): Promise<Catalog> {
  const data = await linearRequest(options, CATALOG_QUERY, {}, CatalogDataSchema);
  return {
    teams: data.teams.nodes
      .map((team) => ({
        id: team.id,
        key: team.key,
        name: team.name,
        states: team.states.nodes,
        members: [...team.members.nodes].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    projects: data.projects.nodes
      .map((project) => ({
        id: project.id,
        name: project.name,
        teamIds: project.teams.nodes.map((team) => team.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---- One issue, and the single mutation --------------------------------------------------

const DetailSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  url: z.string(),
  priority: z.number(),
  priorityLabel: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dueDate: z.string().nullish(),
  state: z.object({ id: z.string(), name: z.string(), type: z.string() }),
  assignee: z.object({ id: z.string(), name: z.string() }).nullish(),
  team: z.object({ id: z.string(), key: z.string(), name: z.string() }).nullish(),
  project: z.object({ id: z.string(), name: z.string() }).nullish(),
  comments: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        body: z.string(),
        createdAt: z.string(),
        user: z.object({ name: z.string() }).nullish(),
      }),
    ),
    pageInfo: z.object({ hasNextPage: z.boolean() }),
  }),
  attachments: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullish(),
        subtitle: z.string().nullish(),
        sourceType: z.string().nullish(),
        url: z.string(),
      }),
    ),
    pageInfo: z.object({ hasNextPage: z.boolean() }),
  }),
});

const ISSUE_FIELDS = `
  id identifier title description url priority priorityLabel createdAt updatedAt dueDate
  state { id name type }
  assignee { id name }
  team { id key name }
  project { id name }
  comments(first: 50) { nodes { id body createdAt user { name } } pageInfo { hasNextPage } }
  attachments(first: 50) { nodes { id title subtitle sourceType url } pageInfo { hasNextPage } }
`;

const ISSUE_QUERY = `query PaseoLinearIssue($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`;

const UPDATE_MUTATION = `
  mutation PaseoLinearIssueUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) { success issue { ${ISSUE_FIELDS} } }
  }
`;

function toDetail(raw: z.output<typeof DetailSchema>): IssueDetail {
  return {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description ?? null,
    url: raw.url,
    priority: raw.priority,
    priorityLabel: raw.priorityLabel,
    state: raw.state,
    assignee: raw.assignee ?? null,
    team: raw.team ?? null,
    project: raw.project ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    dueDate: raw.dueDate ?? null,
    comments: raw.comments.nodes.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author: comment.user?.name ?? null,
      createdAt: comment.createdAt,
    })),
    commentsTruncated: raw.comments.pageInfo.hasNextPage,
    attachments: raw.attachments.nodes.map((attachment) => ({
      id: attachment.id,
      title: attachment.title?.trim() || attachment.url,
      subtitle: attachment.subtitle ?? null,
      source: attachment.sourceType ?? null,
      url: safeExternalUrl(attachment.url),
    })),
    attachmentsTruncated: raw.attachments.pageInfo.hasNextPage,
  };
}

export async function fetchIssue(options: LinearOptions & { id: string }): Promise<IssueDetail> {
  const data = await linearRequest(
    options,
    ISSUE_QUERY,
    { id: options.id },
    z.object({ issue: DetailSchema.nullable() }),
  );
  if (!data.issue) throw new LinearApiError("That issue no longer exists in Linear");
  return toDetail(data.issue);
}

/** Builds the IssueUpdateInput from only the fields the caller sent. */
export function buildUpdateInput(update: IssueUpdate): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (update.title !== undefined) {
    const title = update.title.trim();
    if (!title) throw new LinearApiError("The title cannot be empty");
    input.title = title;
  }
  if (update.description !== undefined) input.description = update.description;
  if (update.stateId !== undefined) input.stateId = update.stateId;
  if (update.priority !== undefined) input.priority = update.priority;
  if (update.assigneeId !== undefined) input.assigneeId = update.assigneeId;
  return input;
}

export async function updateIssue(
  options: LinearOptions & { update: IssueUpdate },
): Promise<IssueDetail> {
  const input = buildUpdateInput(options.update);
  const data = await linearRequest(
    options,
    UPDATE_MUTATION,
    { id: options.update.id, input },
    z.object({
      issueUpdate: z.object({ success: z.boolean(), issue: DetailSchema.nullish() }),
    }),
  );
  if (!data.issueUpdate.success || !data.issueUpdate.issue) {
    throw new LinearApiError("Linear did not apply the change. The issue is unchanged");
  }
  return toDetail(data.issueUpdate.issue);
}
