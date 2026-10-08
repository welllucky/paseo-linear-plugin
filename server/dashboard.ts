import type { RpcOutput } from "@getpaseo/plugin";
import type { getDashboardRpc } from "../shared/dashboard";
import { summarize } from "../shared/summarize";
import { fetchOpenIssues, LinearApiError } from "./linear";

export async function getDashboard(): Promise<RpcOutput<typeof getDashboardRpc>> {
  const apiKey = (process.env.LINEAR_API_KEY ?? "").trim();
  if (!apiKey) return { status: "not_configured" };
  try {
    const { issues, truncated } = await fetchOpenIssues({ apiKey });
    return { status: "ready", summary: summarize(issues, { truncated, now: new Date() }) };
  } catch (error) {
    // Never include the key; LinearApiError messages are written without it.
    const message =
      error instanceof LinearApiError ? error.message : "Could not read data from Linear";
    console.error("linear-dashboard:", error instanceof Error ? error.name : "error", message);
    return { status: "error", message };
  }
}
