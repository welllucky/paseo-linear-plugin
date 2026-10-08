import type { PluginHostProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { getCatalogRpc, getDashboardRpc } from "../shared/dashboard";
import { resolveProjectFilter } from "../shared/links";
import { WorkspaceBar, type WorkspaceBinding } from "./binding";
import { IssuePanel } from "./detail";
import { Chip, ErrorNotice, FilterRow, IssueList, Overview, QuietButton } from "./parts";
import { useStyles } from "./styles";

// Manual refresh only: no polling and no refetch on focus.
const MANUAL = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: false,
} as const;

/**
 * The Linear view shared by the full screen and the workspace and Explorer panel. Without a
 * `binding` (the global screen) it behaves as before and only the manual filters apply.
 */
export function DashboardView({
  theme,
  layout,
  onOpenSettings,
  binding,
}: Pick<PluginHostProps, "theme" | "layout"> & {
  onOpenSettings?: () => void;
  binding?: WorkspaceBinding;
}) {
  const getDashboard = useRpc(getDashboardRpc);
  const getCatalog = useRpc(getCatalogRpc);
  const queryClient = useQueryClient();
  const styles = useStyles(theme, layout.compact);
  const [teamId, setTeamId] = useState(undefined as string | undefined);
  const [manualProjectId, setManualProjectId] = useState(undefined as string | undefined);
  const [selectedId, setSelectedId] = useState(null as string | null);

  const catalogQuery = useQuery({
    queryKey: ["linear-dashboard", "catalog"],
    queryFn: () => getCatalog({}),
    ...MANUAL,
  });
  const catalog = catalogQuery.data?.status === "ready" ? catalogQuery.data.data : null;
  const filter = resolveProjectFilter({
    link: binding?.link ?? null,
    manualProjectId,
    catalogProjectIds: catalog ? catalog.projects.map((project) => project.id) : null,
  });
  const projectId = filter.projectId;

  const query = useQuery({
    queryKey: ["linear-dashboard", "summary", teamId ?? null, projectId ?? null],
    queryFn: () => getDashboard({ teamId, projectId }),
    ...MANUAL,
  });
  useEffect(() => setSelectedId(null), [projectId]);

  const result = query.data;
  const busy = query.isFetching || catalogQuery.isFetching;
  const projects = catalog?.projects.filter((p) => !teamId || p.teamIds.includes(teamId)) ?? [];

  const refresh = () => {
    void query.refetch();
    void catalogQuery.refetch();
    if (selectedId) {
      void queryClient.invalidateQueries({ queryKey: ["linear-dashboard", "issue", selectedId] });
    }
  };
  const pickTeam = (id: string | undefined) => {
    setTeamId(id);
    setManualProjectId(undefined);
    setSelectedId(null);
  };
  const pickProject = (id: string | undefined) => {
    setManualProjectId(id);
    setSelectedId(null);
  };
  const clearFilters = () => {
    setTeamId(undefined);
    setManualProjectId(undefined);
  };

  const showDetail = selectedId !== null;
  const hideList = layout.compact && showDetail;
  const filtered = Boolean(teamId) || filter.source === "manual";
  const subtitle =
    result?.status === "ready"
      ? `${result.data.total}${result.data.truncated ? "+" : ""} open · updated ${new Date(result.data.fetchedAt).toLocaleTimeString()}`
      : "Open issues";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={[styles.panelRow, styles.panelFirst, styles.headerRow]}>
          <View style={styles.headerText}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.headline}>
              Linear
            </Text>
            <Text numberOfLines={1} style={styles.small}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? "Refreshing Linear issues" : "Refresh Linear issues"}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[styles.buttonSmall, busy ? { opacity: 0.6 } : null]}
            onPress={refresh}
          >
            <Text style={styles.buttonText}>{busy ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
        </View>

        {binding ? (
          <WorkspaceBar
            binding={{ ...binding, stale: binding.stale || filter.stale }}
            catalog={catalog}
            teamId={teamId}
            theme={theme}
            styles={styles}
          />
        ) : null}

        {catalog && !hideList ? (
          <View style={styles.panelRow}>
            <FilterRow label="Team" styles={styles}>
              <Chip
                label="All"
                selected={!teamId}
                styles={styles}
                onPress={() => pickTeam(undefined)}
              />
              {catalog.teams.map((team) => (
                <Chip
                  key={team.id}
                  label={team.name}
                  selected={team.id === teamId}
                  styles={styles}
                  onPress={() => pickTeam(team.id)}
                />
              ))}
            </FilterRow>
            {filter.source === "link" ? null : (
              <FilterRow label="Project" styles={styles}>
                <Chip
                  label="All"
                  selected={!manualProjectId}
                  styles={styles}
                  onPress={() => pickProject(undefined)}
                />
                {projects.map((project) => (
                  <Chip
                    key={project.id}
                    label={project.name}
                    selected={project.id === manualProjectId}
                    styles={styles}
                    onPress={() => pickProject(project.id)}
                  />
                ))}
              </FilterRow>
            )}
          </View>
        ) : null}

        {query.isPending ? (
          <View style={[styles.panelRow, styles.filterRow]}>
            <ActivityIndicator
              accessibilityLabel="Loading Linear issues"
              color={theme.colors.accent}
            />
            <Text style={styles.small}>Loading issues…</Text>
          </View>
        ) : null}
        {result?.status === "ready" && !hideList ? (
          <Overview summary={result.data} theme={theme} styles={styles} />
        ) : null}
      </View>

      {query.isError ? (
        <ErrorNotice
          message="Could not reach the Paseo daemon."
          styles={styles}
          onRetry={refresh}
        />
      ) : null}
      {result?.status === "not_configured" ? (
        <View style={styles.notice}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Linear is not connected
          </Text>
          <Text style={styles.body}>
            Add a personal API key in the plugin settings. It stays on the daemon and is never sent
            back to the app. The daemon also falls back to LINEAR_API_KEY.
          </Text>
          {onOpenSettings ? (
            <QuietButton label="Open settings" onPress={onOpenSettings} styles={styles} />
          ) : null}
        </View>
      ) : null}
      {result?.status === "error" ? (
        <ErrorNotice message={result.message} styles={styles} onRetry={refresh} />
      ) : null}
      {catalogQuery.data?.status === "error" ? (
        <ErrorNotice
          message={`Teams and projects unavailable: ${catalogQuery.data.message}`}
          styles={styles}
        />
      ) : null}

      {result?.status === "ready" ? (
        <View style={styles.split}>
          {hideList ? null : (
            <View style={[styles.panel, styles.listPane]}>
              <IssueList
                issues={result.data.recent}
                selectedId={selectedId}
                onSelect={setSelectedId}
                styles={styles}
                theme={theme}
                emptyHint={
                  filtered ? (
                    <QuietButton label="Clear filters" onPress={clearFilters} styles={styles} />
                  ) : undefined
                }
              />
            </View>
          )}
          {selectedId ? (
            <View style={styles.detailPane}>
              <IssuePanel
                issueId={selectedId}
                catalog={catalog}
                theme={theme}
                styles={styles}
                onBack={layout.compact ? () => setSelectedId(null) : null}
                onChanged={() => void query.refetch()}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
