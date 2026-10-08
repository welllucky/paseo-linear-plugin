import { z } from "zod";
import type { Catalog, IssueDetail, IssueFilter, IssueUpdate } from "../shared/dashboard";
import type { RawIssue } from "../shared/summarize";
import { safeExternalUrl } from "../shared/urls";
import { HISTORY_FIELDS, HistorySchema, toActivity } from "./activity";

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
  if (status === 401 || status === 403)
    return "Linear rejected the API key. Check it in plugin settings";
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

/** Confirms the key works and names whose key it is. */
export async function fetchViewer(options: LinearOptions): Promise<{ viewer: string }> {
  const data = await linearRequest(
    options,
    "query PaseoLinearViewer { viewer { name } }",
    {},
    z.object({ viewer: z.object({ name: z.string() }) }),
  );
  return { viewer: data.viewer.name };
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

// Linear rejects a single query that nests connections ("Query too complex"), so the
// catalog is read in small requests: one list of teams, then each team's own connections.
// Every request stays far below the limit and the shapes below are paginated independently.

const PageInfoSchema = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

function connection<T extends z.ZodType>(node: T) {
  return z.object({ nodes: z.array(node), pageInfo: PageInfoSchema });
}

const TeamSchema = z.object({ id: z.string(), key: z.string(), name: z.string() });
const StateSchema = z.object({ id: z.string(), name: z.string(), type: z.string() });
const MemberSchema = z.object({ id: z.string(), name: z.string() });
const ProjectSchema = z.object({ id: z.string(), name: z.string() });

const TEAMS_QUERY = `
  query PaseoLinearTeams($after: String) {
    teams(first: 100, after: $after) {
      nodes { id key name }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const TEAM_DETAIL_QUERY = `
  query PaseoLinearTeamDetail($id: String!) {
    team(id: $id) {
      states(first: 100) { nodes { id name type } pageInfo { hasNextPage endCursor } }
      members(first: 100) { nodes { id name } pageInfo { hasNextPage endCursor } }
      projects(first: 100) { nodes { id name } pageInfo { hasNextPage endCursor } }
    }
  }
`;

const TeamDetailSchema = z.object({
  team: z.object({
    states: connection(StateSchema),
    members: connection(MemberSchema),
    projects: connection(ProjectSchema),
  }),
});

type TeamConnection = "states" | "members" | "projects";

const TEAM_PAGE_FIELDS: Record<TeamConnection, string> = {
  states: "id name type",
  members: "id name",
  projects: "id name",
};

/** The next page of one team connection, used only when the first 100 were not enough. */
function teamPageQuery(name: TeamConnection): string {
  return `
    query PaseoLinearTeam_${name}($id: String!, $after: String) {
      team(id: $id) {
        ${name}(first: 100, after: $after) {
          nodes { ${TEAM_PAGE_FIELDS[name]} }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;
}

const CATALOG_CONCURRENCY = 4;

type Page<T> = { nodes: T[]; pageInfo: z.output<typeof PageInfoSchema> };

/** Follows a connection past its first page, up to PAGE_LIMIT pages in all. */
async function readRemainingPages<T>(
  first: Page<T>,
  fetchPage: (after: string) => Promise<Page<T>>,
): Promise<T[]> {
  const nodes = [...first.nodes];
  let { hasNextPage, endCursor } = first.pageInfo;
  for (let page = 1; page < PAGE_LIMIT && hasNextPage && endCursor; page += 1) {
    const next = await fetchPage(endCursor);
    nodes.push(...next.nodes);
    ({ hasNextPage, endCursor } = next.pageInfo);
  }
  return nodes;
}

async function readTeams(options: LinearOptions): Promise<z.output<typeof TeamSchema>[]> {
  const teams: z.output<typeof TeamSchema>[] = [];
  let after: string | null = null;
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const data: { teams: z.output<ReturnType<typeof connection<typeof TeamSchema>>> } =
      await linearRequest(
        options,
        TEAMS_QUERY,
        { after },
        z.object({ teams: connection(TeamSchema) }),
      );
    teams.push(...data.teams.nodes);
    if (!data.teams.pageInfo.hasNextPage || !data.teams.pageInfo.endCursor) break;
    after = data.teams.pageInfo.endCursor;
  }
  return teams;
}

async function readTeamDetail(options: LinearOptions, team: z.output<typeof TeamSchema>) {
  const data = await linearRequest(options, TEAM_DETAIL_QUERY, { id: team.id }, TeamDetailSchema);
  const more = <T extends z.ZodType>(name: TeamConnection, node: T, first: Page<z.output<T>>) =>
    readRemainingPages(first, async (after) => {
      const page = await linearRequest(
        options,
        teamPageQuery(name),
        { id: team.id, after },
        z.object({ team: z.object({ [name]: connection(node) }) }),
      );
      return (page.team as Record<TeamConnection, Page<z.output<T>>>)[name];
    });
  return {
    team,
    states: await more("states", StateSchema, data.team.states),
    members: await more("members", MemberSchema, data.team.members),
    projects: await more("projects", ProjectSchema, data.team.projects),
  };
}

/** Runs the work for every item with at most `limit` requests in flight. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function fetchCatalog(options: LinearOptions): Promise<Catalog> {
  const teams = await readTeams(options);
  const details = await mapLimited(teams, CATALOG_CONCURRENCY, (team) =>
    readTeamDetail(options, team),
  );

  const projects = new Map<string, { id: string; name: string; teamIds: string[] }>();
  for (const detail of details) {
    for (const project of detail.projects) {
      const entry = projects.get(project.id) ?? { ...project, teamIds: [] };
      if (!entry.teamIds.includes(detail.team.id)) entry.teamIds.push(detail.team.id);
      projects.set(project.id, entry);
    }
  }

  return {
    teams: details
      .map(({ team, states, members }) => ({
        ...team,
        states,
        members: [...members].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    projects: [...projects.values()].sort((a, b) => a.name.localeCompare(b.name)),
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
  history: z.object({ nodes: z.array(HistorySchema) }).nullish(),
});

const ISSUE_FIELDS = `
  id identifier title description url priority priorityLabel createdAt updatedAt dueDate
  state { id name type }
  assignee { id name }
  team { id key name }
  project { id name }
  comments(first: 50) { nodes { id body createdAt user { name } } pageInfo { hasNextPage } }
  attachments(first: 50) { nodes { id title subtitle sourceType url } pageInfo { hasNextPage } }
  ${HISTORY_FIELDS}
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
    activity: toActivity(raw.history?.nodes ?? []),
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
