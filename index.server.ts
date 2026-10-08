import type { PluginServerContext } from "@getpaseo/plugin/server";
import { changeIssue, getCatalog, getDashboard, getIssue } from "./server/dashboard";
import { getCatalogRpc, getDashboardRpc, getIssueRpc, updateIssueRpc } from "./shared/dashboard";

export default function contribute(server: PluginServerContext) {
  server.handle(getDashboardRpc, getDashboard);
  server.handle(getCatalogRpc, getCatalog);
  server.handle(getIssueRpc, getIssue);
  server.handle(updateIssueRpc, changeIssue);
  return () => {};
}
