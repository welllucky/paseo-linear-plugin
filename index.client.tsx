import type {
  PluginClientContext,
  PluginScreenProps,
  PluginSidebarItemProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { DashboardView } from "./client/dashboard";
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

  // The Explorer column is narrow, so the panel always uses the stacked layout.
  function DashboardPanel({ theme, layout }: PluginWorkspacePanelProps) {
    return (
      <DashboardView
        theme={theme}
        layout={{ ...layout, compact: true }}
        onOpenSettings={openSettings}
      />
    );
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
