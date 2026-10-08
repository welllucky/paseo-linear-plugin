import type { PluginServerContext } from "@getpaseo/plugin/server";
import { handlers } from "./server/dashboard";
import {
  checkConnectionRpc,
  clearTokenRpc,
  getCatalogRpc,
  getDashboardRpc,
  getIssueRpc,
  getTokenStatusRpc,
  saveTokenRpc,
  updateIssueRpc,
} from "./shared/dashboard";
import { workspaceLinks } from "./shared/links";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(workspaceLinks);
  server.handle(getDashboardRpc, handlers.getDashboard);
  server.handle(getCatalogRpc, handlers.getCatalog);
  server.handle(getIssueRpc, handlers.getIssue);
  server.handle(updateIssueRpc, handlers.changeIssue);
  server.handle(getTokenStatusRpc, handlers.getTokenStatus);
  server.handle(saveTokenRpc, handlers.saveToken);
  server.handle(clearTokenRpc, handlers.clearToken);
  server.handle(checkConnectionRpc, handlers.checkConnection);
  return () => {};
}
