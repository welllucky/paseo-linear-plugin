type Call = { query: string; variables: Record<string, any>; auth: string | null };

export function mockFetch(respond: (call: Call) => unknown, status = 200) {
  const calls: Call[] = [];
  const request = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const headers = init.headers as Record<string, string>;
    const call = {
      query: body.query,
      variables: body.variables,
      auth: headers.Authorization ?? null,
    };
    calls.push(call);
    return new Response(JSON.stringify(respond(call)), { status });
  }) as typeof fetch;
  return { calls, request };
}

export const detail = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  identifier: "ENG-1",
  title: "Title",
  description: "Body",
  url: "https://linear.app/x/issue/ENG-1",
  priority: 2,
  priorityLabel: "High",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  dueDate: null,
  state: { id: "s1", name: "Todo", type: "unstarted" },
  assignee: null,
  team: { id: "t1", key: "ENG", name: "Eng" },
  project: null,
  comments: {
    nodes: [{ id: "c1", body: "hi", createdAt: "2026-10-02T00:00:00.000Z", user: null }],
    pageInfo: { hasNextPage: false },
  },
  attachments: {
    nodes: [
      { id: "a1", title: "Spec", subtitle: null, sourceType: "figma", url: "https://figma.com/x" },
      { id: "a2", title: null, subtitle: null, sourceType: null, url: "javascript:alert(1)" },
    ],
    pageInfo: { hasNextPage: true },
  },
  ...over,
});

/** Linear rejects a query whose estimated cost passes this (its documented complexity limit). */
export const LINEAR_COMPLEXITY_LIMIT = 10_000;

/**
 * Rough model of Linear's query complexity: each field costs 1, multiplied by the `first`
 * sizes of every connection it sits inside. Good enough to tell nested lists from flat ones.
 */
export function estimateComplexity(query: string): number {
  const tokens = query.match(/[A-Za-z_][A-Za-z0-9_]*|\([^)]*\)|[{}]/g) ?? [];
  const stack = [1];
  let pending = 1;
  let cost = 0;
  for (const token of tokens) {
    if (token === "}") {
      stack.pop();
    } else if (token === "{") {
      stack.push(stack[stack.length - 1] * pending);
      pending = 1;
    } else if (token.startsWith("(")) {
      pending = Number(/first:\s*(\d+)/.exec(token)?.[1] ?? 1);
    } else {
      cost += stack[stack.length - 1];
      pending = 1;
    }
  }
  return cost;
}

/** A mock Linear that answers 400 "Query too complex" like the real API does. */
export function complexityLimitedFetch(respond: (call: Call) => unknown) {
  const calls: Call[] = [];
  const request = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const call = { query: body.query, variables: body.variables, auth: null };
    calls.push(call);
    if (estimateComplexity(body.query) > LINEAR_COMPLEXITY_LIMIT) {
      return new Response(JSON.stringify({ errors: [{ message: "Query too complex" }] }), {
        status: 400,
      });
    }
    return new Response(JSON.stringify(respond(call)), { status: 200 });
  }) as typeof fetch;
  return { calls, request };
}
