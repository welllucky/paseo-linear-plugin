import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

/** What a workspace is linked to: ids and display names only, never a credential. */
export const linkEntry = z.object({
  projectId: z.string().min(1),
  projectName: z.string(),
  /** The local project's display name when it was linked, shown if the workspace is gone. */
  localName: z.string(),
});

/**
 * Local project root path -> Linear project. Host-scoped, so every client of this daemon
 * sees the same links. The keys are paths from `normalizeRootPath`.
 */
export const workspaceLinks = defineSettings({
  id: "workspace-links",
  scope: "host",
  version: 1,
  schema: z.object({ links: z.record(z.string(), linkEntry).default({}) }),
});

export type LinkEntry = z.infer<typeof linkEntry>;
export type LinksDocument = { links: Record<string, LinkEntry> };

/** One key per project root: forward slashes, no trailing slash (a bare root stays "/"). */
export function normalizeRootPath(path: string): string {
  const slashed = path.trim().replace(/\\/g, "/");
  const trimmed = slashed.replace(/\/+$/, "");
  return trimmed === "" && slashed.startsWith("/") ? "/" : trimmed;
}

export function findLink(doc: LinksDocument, rootPath: string): LinkEntry | null {
  const key = normalizeRootPath(rootPath);
  if (!key) return null;
  return Object.hasOwn(doc.links, key) ? doc.links[key] : null;
}

export function withLink(doc: LinksDocument, rootPath: string, entry: LinkEntry): LinksDocument {
  const key = normalizeRootPath(rootPath);
  if (!key) return doc;
  return { ...doc, links: { ...doc.links, [key]: entry } };
}

export function withoutLink(doc: LinksDocument, rootPath: string): LinksDocument {
  const key = normalizeRootPath(rootPath);
  const { [key]: _removed, ...rest } = doc.links;
  return { ...doc, links: rest };
}

export type FilterSource = "link" | "manual" | "none";

/**
 * Picks the project filter. A link to the current workspace wins over the manual choice. If the
 * catalog is loaded and no longer has the linked project, the link is stale: it is not applied
 * (it would show an empty list) and the manual choice stays in force.
 */
export function resolveProjectFilter(input: {
  link: LinkEntry | null;
  manualProjectId: string | undefined;
  /** Null while the catalog has not loaded. */
  catalogProjectIds: readonly string[] | null;
}): { projectId: string | undefined; source: FilterSource; stale: boolean } {
  const { link, manualProjectId, catalogProjectIds } = input;
  const manual = manualProjectId
    ? { projectId: manualProjectId, source: "manual" as const }
    : { projectId: undefined, source: "none" as const };
  if (!link) return { ...manual, stale: false };
  if (catalogProjectIds && !catalogProjectIds.includes(link.projectId)) {
    return { ...manual, stale: true };
  }
  return { projectId: link.projectId, source: "link", stale: false };
}

/** Catalog projects matching a search text, limited to a team when one is selected. */
export function filterProjects<P extends { name: string; teamIds: string[] }>(
  projects: readonly P[],
  query: string,
  teamId?: string,
): P[] {
  const needle = query.trim().toLocaleLowerCase();
  return projects.filter(
    (project) =>
      (!teamId || project.teamIds.includes(teamId)) &&
      (!needle || project.name.toLocaleLowerCase().includes(needle)),
  );
}
