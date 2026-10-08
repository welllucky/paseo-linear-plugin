import type {
  PluginClientContext,
  PluginScreenProps,
  PluginSidebarItemProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { DashboardView } from "./client/dashboard";
import { WorkspacePanel } from "./client/panel";
import { SettingsScreen } from "./client/settings";
import { DASHBOARD_PANEL, DASHBOARD_SCREEN, SETTINGS_SCREEN } from "./shared/surfaces";

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
  const openSettings = () => client.openSettings(SETTINGS_SCREEN.id);

  function DashboardScreen({ theme, layout }: PluginScreenProps) {
    return <DashboardView theme={theme} layout={layout} onOpenSettings={openSettings} />;
  }

  function DashboardPanel(props: PluginWorkspacePanelProps) {
    return <WorkspacePanel {...props} onOpenSettings={openSettings} />;
  }

  const removers = [
    client.addScreen({ ...DASHBOARD_SCREEN, Component: DashboardScreen }),
    client.addSidebarHeaderItem({ id: "dashboard", title: "Linear", Component: DashboardItem }),
    client.addWorkspacePanel({
      ...DASHBOARD_PANEL,
      locations: [...DASHBOARD_PANEL.locations],
      Component: DashboardPanel,
    }),
    client.addSettingsScreen({ ...SETTINGS_SCREEN, Component: SettingsScreen }),
  ];
  return () => {
    for (const remove of removers) remove();
  };
}
