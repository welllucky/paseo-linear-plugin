import type { PluginServerContext } from "@getpaseo/plugin/server";
import { getDashboard } from "./server/dashboard";
import { getDashboardRpc } from "./shared/dashboard";

export default function contribute(server: PluginServerContext) {
  server.handle(getDashboardRpc, getDashboard);
  return () => {};
}
