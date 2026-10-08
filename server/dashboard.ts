import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type {
  getCatalogRpc,
  getDashboardRpc,
  getIssueRpc,
  updateIssueRpc,
} from "../shared/dashboard";
import { summarize } from "../shared/summarize";
import {
  type CredentialStore,
  createCredentialStore,
  InvalidTokenError,
  redact,
} from "./credentials";
import {
  fetchCatalog,
  fetchIssue,
  fetchOpenIssues,
  fetchViewer,
  LinearApiError,
  type LinearOptions,
  updateIssue,
} from "./linear";

type Outcome<T> =
  | { status: "ready"; data: T }
  | { status: "not_configured" }
  | { status: "error"; message: string };

export interface HandlerDeps {
  credentials: CredentialStore;
  request?: typeof fetch;
}

const UNKNOWN_FAILURE = "Could not read data from Linear";

export function createHandlers({ credentials, request }: HandlerDeps) {
  /** Runs one Linear call. Resolves the token per call so no module state holds it. */
  async function run<T>(
    label: string,
    work: (options: LinearOptions) => Promise<T>,
  ): Promise<Outcome<T>> {
    let resolved: Awaited<ReturnType<CredentialStore["resolve"]>> = null;
    try {
      resolved = await credentials.resolve();
    } catch (error) {
      console.error(`linear-dashboard ${label}: could not read the saved token`, errorName(error));
      return { status: "error", message: "Could not read the saved Linear API key" };
    }
    if (!resolved) return { status: "not_configured" };
    const { token } = resolved;
    try {
      return {
        status: "ready",
        data: await work({ apiKey: token, request: request ?? ((...args) => fetch(...args)) }),
      };
    } catch (error) {
      const message =
        error instanceof LinearApiError ? redact(error.message, [token]) : UNKNOWN_FAILURE;
      console.error(`linear-dashboard ${label}:`, errorName(error), message);
      return { status: "error", message };
    }
  }

  async function tokenStatus() {
    const resolved = await credentials.resolve();
    return {
      configured: resolved !== null,
      source: resolved?.source ?? ("none" as const),
    };
  }

  async function settle(label: string, work: () => Promise<void>) {
    try {
      await work();
      return { status: "ready" as const, data: await tokenStatus() };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        return { status: "error" as const, message: error.message };
      }
      console.error(`linear-dashboard ${label}:`, errorName(error));
      return { status: "error" as const, message: "Could not update the saved Linear API key" };
    }
  }

  return {
    getDashboard(
      input: RpcInput<typeof getDashboardRpc>,
    ): Promise<RpcOutput<typeof getDashboardRpc>> {
      return run("summary", async (options) => {
        const { issues, truncated } = await fetchOpenIssues({ ...options, filter: input });
        return summarize(issues, { truncated, now: new Date() });
      });
    },
    getCatalog(): Promise<RpcOutput<typeof getCatalogRpc>> {
      return run("catalog", fetchCatalog);
    },
    getIssue(input: RpcInput<typeof getIssueRpc>): Promise<RpcOutput<typeof getIssueRpc>> {
      return run("issue", (options) => fetchIssue({ ...options, id: input.id }));
    },
    changeIssue(input: RpcInput<typeof updateIssueRpc>): Promise<RpcOutput<typeof updateIssueRpc>> {
      return run("update", (options) => updateIssue({ ...options, update: input }));
    },
    checkConnection() {
      return run("check", fetchViewer);
    },
    getTokenStatus() {
      return settle("token status", async () => {});
    },
    saveToken({ token }: { token: string }) {
      return settle("token save", () => credentials.save(token));
    },
    clearToken() {
      return settle("token clear", () => credentials.clear());
    },
  };
}

/** Error class only; messages from the file system or the network can carry paths or secrets. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "error";
}

export const handlers = createHandlers({ credentials: createCredentialStore() });
