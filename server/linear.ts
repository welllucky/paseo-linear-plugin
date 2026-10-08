import { z } from "zod";
import type { RawIssue } from "../shared/summarize";

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
});

const ResponseSchema = z.object({
  data: z
    .object({
      issues: z.object({
        nodes: z.array(IssueSchema),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      }),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

// Read-only: a single query, no mutations. Only open work is counted.
const OPEN_ISSUES_QUERY = `
  query PaseoLinearDashboard($after: String) {
    issues(
      first: 100
      after: $after
      orderBy: updatedAt
      filter: { state: { type: { nin: ["completed", "canceled"] } } }
    ) {
      nodes {
        id identifier title url priority priorityLabel updatedAt
        state { name type }
        assignee { name }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PAGE_LIMIT = 5;

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

export async function fetchOpenIssues(options: {
  apiKey: string;
  endpoint?: string;
  request?: typeof fetch;
}): Promise<{ issues: RawIssue[]; truncated: boolean }> {
  const endpoint = options.endpoint ?? "https://api.linear.app/graphql";
  const request = options.request ?? fetch;
  const issues: RawIssue[] = [];
  let after: string | null = null;

  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const response = await request(endpoint, {
      method: "POST",
      headers: { Authorization: options.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query: OPEN_ISSUES_QUERY, variables: { after } }),
    });
    if (!response.ok) throw new LinearApiError(describeHttpFailure(response.status));
    const body = ResponseSchema.parse(await response.json());
    if (body.errors?.length) {
      throw new LinearApiError(body.errors.map((error) => error.message).join("; "));
    }
    if (!body.data) throw new LinearApiError("Linear returned no issue data");
    issues.push(...body.data.issues.nodes);
    const { hasNextPage, endCursor } = body.data.issues.pageInfo;
    if (!hasNextPage || !endCursor) return { issues, truncated: false };
    after = endCursor;
  }
  return { issues, truncated: true };
}
