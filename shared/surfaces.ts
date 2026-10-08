/** Registration data for the surfaces the client entry contributes, kept apart from the components. */
export const DASHBOARD_PANEL = {
  id: "dashboard",
  title: "Linear",
  icon: "LayoutDashboard",
  context: "workspace",
  /** "explorer" is the right-side Explorer column; "workspace" is a tab beside agents and files. */
  locations: ["workspace", "explorer"],
} as const;

export const DASHBOARD_SCREEN = { id: "dashboard", title: "Linear" } as const;

export const SETTINGS_SCREEN = { id: "settings", title: "Linear", icon: "KeyRound" } as const;

/** The Explorer column and workspace tabs are narrow, so panels always use the stacked layout. */
export function panelLayout<L extends { compact: boolean }>(layout: L): L {
  return layout.compact ? layout : { ...layout, compact: true };
}
