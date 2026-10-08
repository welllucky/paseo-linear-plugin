import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { getCatalogRpc, getDashboardRpc } from "../shared/dashboard";
import { IssuePanel } from "./detail";
import { Chip, ErrorNotice, IssueList, Totals } from "./parts";
import { useStyles } from "./styles";

// Manual refresh only: no polling and no refetch on focus.
const MANUAL = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: false,
} as const;

export function DashboardScreen({ theme, layout }: PluginScreenProps) {
  const getDashboard = useRpc(getDashboardRpc);
  const getCatalog = useRpc(getCatalogRpc);
  const queryClient = useQueryClient();
  const styles = useStyles(theme, layout.compact);
  const [teamId, setTeamId] = useState(undefined as string | undefined);
  const [projectId, setProjectId] = useState(undefined as string | undefined);
  const [selectedId, setSelectedId] = useState(null as string | null);

  const query = useQuery({
    queryKey: ["linear-dashboard", "summary", teamId ?? null, projectId ?? null],
    queryFn: () => getDashboard({ teamId, projectId }),
    ...MANUAL,
  });
  const catalogQuery = useQuery({
    queryKey: ["linear-dashboard", "catalog"],
    queryFn: () => getCatalog({}),
    ...MANUAL,
  });
  const result = query.data;
  const catalog = catalogQuery.data?.status === "ready" ? catalogQuery.data.data : null;
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
    setProjectId(undefined);
    setSelectedId(null);
  };
  const pickProject = (id: string | undefined) => {
    setProjectId(id);
    setSelectedId(null);
  };

  const showDetail = selectedId !== null;
  const hideList = layout.compact && showDetail;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Linear issues
        </Text>
        <Text style={styles.muted}>
          Open issues, with details and edits.
          {result?.status === "ready"
            ? ` Updated ${new Date(result.data.fetchedAt).toLocaleTimeString()}.`
            : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? "Refreshing Linear issues" : "Refresh Linear issues"}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          style={[styles.button, busy ? { opacity: 0.6 } : null]}
          onPress={refresh}
        >
          <Text style={styles.buttonText}>{busy ? "Refreshing…" : "Refresh"}</Text>
        </Pressable>
      </View>

      {query.isPending ? (
        <ActivityIndicator accessibilityLabel="Loading Linear issues" color={theme.colors.accent} />
      ) : null}
      {query.isError ? (
        <ErrorNotice message="Could not reach the Paseo daemon. Try refreshing." styles={styles} />
      ) : null}

      {result?.status === "not_configured" ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Linear is not connected
          </Text>
          <Text style={styles.body}>
            Create a personal API key in Linear (Settings, Security and access) and start the Paseo
            daemon with it set in its environment:
          </Text>
          <Text selectable style={styles.body}>
            LINEAR_API_KEY=lin_api_...
          </Text>
          <Text style={styles.muted}>
            Restart the daemon after changing the key, then press Refresh. The key stays on the
            daemon and is never sent to the app.
          </Text>
        </View>
      ) : null}
      {result?.status === "error" ? <ErrorNotice message={result.message} styles={styles} /> : null}
      {catalogQuery.data?.status === "error" ? (
        <ErrorNotice
          message={`Teams and projects unavailable: ${catalogQuery.data.message}`}
          styles={styles}
        />
      ) : null}

      {catalog && !hideList ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Teams
          </Text>
          <View style={styles.chips}>
            <Chip
              label="All teams"
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
          </View>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Projects
          </Text>
          <View style={styles.chips}>
            <Chip
              label="All projects"
              selected={!projectId}
              styles={styles}
              onPress={() => pickProject(undefined)}
            />
            {projects.map((project) => (
              <Chip
                key={project.id}
                label={project.name}
                selected={project.id === projectId}
                styles={styles}
                onPress={() => pickProject(project.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {result?.status === "ready" ? (
        <>
          {hideList ? null : <Totals summary={result.data} theme={theme} styles={styles} />}
          <View style={styles.split}>
            {hideList ? null : (
              <View style={styles.listPane}>
                <IssueList
                  issues={result.data.recent}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  styles={styles}
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
        </>
      ) : null}
    </ScrollView>
  );
}
