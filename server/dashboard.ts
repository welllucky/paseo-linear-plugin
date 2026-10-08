import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type {
  getCatalogRpc,
  getDashboardRpc,
  getIssueRpc,
  updateIssueRpc,
} from "../shared/dashboard";
import { summarize } from "../shared/summarize";
import {
  fetchCatalog,
  fetchIssue,
  fetchOpenIssues,
  LinearApiError,
  type LinearOptions,
  updateIssue,
} from "./linear";

type Outcome<T> =
  | { status: "ready"; data: T }
  | { status: "not_configured" }
  | { status: "error"; message: string };

/** Runs one Linear call. Reads the key per call so no module state holds it. */
async function run<T>(
  label: string,
  work: (options: LinearOptions) => Promise<T>,
): Promise<Outcome<T>> {
  const apiKey = (process.env.LINEAR_API_KEY ?? "").trim();
  if (!apiKey) return { status: "not_configured" };
  try {
    return { status: "ready", data: await work({ apiKey, request: (...args) => fetch(...args) }) };
  } catch (error) {
    // Never include the key; LinearApiError messages are written without it.
    const message =
      error instanceof LinearApiError ? error.message : "Could not read data from Linear";
    console.error(
      `linear-dashboard ${label}:`,
      error instanceof Error ? error.name : "error",
      message,
    );
    return { status: "error", message };
  }
}

export function getDashboard(
  input: RpcInput<typeof getDashboardRpc>,
): Promise<RpcOutput<typeof getDashboardRpc>> {
  return run("summary", async (options) => {
    const { issues, truncated } = await fetchOpenIssues({ ...options, filter: input });
    return summarize(issues, { truncated, now: new Date() });
  });
}

export function getCatalog(): Promise<RpcOutput<typeof getCatalogRpc>> {
  return run("catalog", fetchCatalog);
}

export function getIssue(
  input: RpcInput<typeof getIssueRpc>,
): Promise<RpcOutput<typeof getIssueRpc>> {
  return run("issue", (options) => fetchIssue({ ...options, id: input.id }));
}

export function changeIssue(
  input: RpcInput<typeof updateIssueRpc>,
): Promise<RpcOutput<typeof updateIssueRpc>> {
  return run("update", (options) => updateIssue({ ...options, update: input }));
}
