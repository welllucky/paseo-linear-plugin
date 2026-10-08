import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { DashboardScreen } from "./client/dashboard";

function DashboardItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="LayoutDashboard"
      active={currentScreen?.screenId === "dashboard"}
      onPress={() => openScreen({ screenId: "dashboard" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "dashboard", title: "Linear", Component: DashboardScreen });
  client.addSidebarHeaderItem({ id: "dashboard", title: "Linear", Component: DashboardItem });
  return () => {};
}
