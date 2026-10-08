import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useSettings, useWorkspace } from "@getpaseo/plugin/client";
import { findLink, withLink, withoutLink, workspaceLinks } from "../shared/links";
import { panelLayout } from "../shared/surfaces";
import type { WorkspaceBinding } from "./binding";
import { DashboardView } from "./dashboard";

/**
 * The workspace and Explorer panel. It reads the local project from the workspace and the
 * saved link from the host-scoped settings, and hands both to the shared view.
 */
export function WorkspacePanel({
  theme,
  layout,
  workspaceId,
  onOpenSettings,
}: PluginWorkspacePanelProps & { onOpenSettings: () => void }) {
  const project = useWorkspace(workspaceId, (workspace) => ({
    rootPath: workspace.projectRootPath,
    displayName: workspace.projectDisplayName,
  }));
  const links = useSettings(workspaceLinks);

  const ready = links.status === "ready";
  const rootPath = project?.rootPath ?? "";
  const link = ready ? findLink(links.values, rootPath) : null;
  const localName = project?.displayName ?? "";

  const binding: WorkspaceBinding = {
    localName,
    rootPath,
    link,
    stale: false,
    loading: links.status === "loading" || !project,
    saving: links.saving,
    error:
      links.saveError ??
      (links.status === "error" || links.status === "invalid"
        ? "Saved workspace links could not be read."
        : null),
    onLink: (target) => {
      if (!ready) return;
      void links.save(
        withLink(links.values, rootPath, {
          projectId: target.id,
          projectName: target.name,
          localName,
        }),
        links.revision,
      );
    },
    onUnlink: () => {
      if (!ready) return;
      void links.save(withoutLink(links.values, rootPath), links.revision);
    },
  };

  // The Explorer column is narrow, so the panel always uses the stacked layout.
  return (
    <DashboardView
      theme={theme}
      layout={panelLayout(layout)}
      onOpenSettings={onOpenSettings}
      binding={project ? binding : undefined}
    />
  );
}
