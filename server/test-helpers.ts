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
