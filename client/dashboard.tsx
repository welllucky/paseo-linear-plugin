import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import type { DashboardSummary } from "../shared/dashboard";
import { getDashboardRpc } from "../shared/dashboard";
import { openExternal } from "./web";

type PluginTheme = PluginScreenProps["theme"];
type Row = { name: string; count: number };

function useStyles(theme: PluginTheme, compact: boolean) {
  return useMemo(() => {
    const gap = compact ? 12 : 16;
    return {
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: compact ? 16 : 24, gap },
      header: { gap: 8 },
      title: { color: theme.colors.foreground, fontSize: compact ? 20 : 24, fontWeight: "600" as const },
      muted: { color: theme.colors.foregroundMuted, fontSize: 13 },
      body: { color: theme.colors.foreground, fontSize: 14 },
      danger: { color: theme.colors.statusDanger, fontSize: 14 },
      card: {
        gap: 8,
        padding: compact ? 12 : 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      },
      cardTitle: { color: theme.colors.foreground, fontSize: 15, fontWeight: "600" as const },
      grid: { flexDirection: compact ? ("column" as const) : ("row" as const), flexWrap: "wrap" as const, gap },
      gridItem: compact ? {} : { flexGrow: 1, flexBasis: 280 },
      total: { color: theme.colors.foreground, fontSize: 36, fontWeight: "700" as const },
      line: { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 8 },
      lineName: { color: theme.colors.foreground, fontSize: 14, flexShrink: 1 },
      track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surface2 },
      button: {
        minHeight: 44,
        paddingHorizontal: 16,
        justifyContent: "center" as const,
        alignSelf: "flex-start" as const,
        borderRadius: 8,
        backgroundColor: theme.colors.accent,
      },
      buttonText: { color: theme.colors.accentForeground, fontSize: 14, fontWeight: "600" as const },
      issue: { minHeight: 44, gap: 2, justifyContent: "center" as const },
    };
  }, [theme, compact]);
}

type Styles = ReturnType<typeof useStyles>;

function Breakdown({
  title,
  rows,
  theme,
  styles,
}: {
  title: string;
  rows: Row[];
  theme: PluginTheme;
  styles: Styles;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <View style={[styles.card, styles.gridItem]} accessible={false}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {title}
      </Text>
      {rows.length === 0 ? <Text style={styles.muted}>No issues</Text> : null}
      {rows.map((row) => (
        <View
          key={row.name}
          accessible
          accessibilityLabel={`${row.name}: ${row.count} ${row.count === 1 ? "issue" : "issues"}`}
          style={{ gap: 4 }}
        >
          <View style={styles.line}>
            <Text style={styles.lineName} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.body}>{row.count}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${Math.round((row.count / max) * 100)}%`,
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function Summary({
  summary,
  theme,
  styles,
}: {
  summary: DashboardSummary;
  theme: PluginTheme;
  styles: Styles;
}) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.muted}>Open issues</Text>
        <Text
          style={styles.total}
          accessibilityLabel={`${summary.total}${summary.truncated ? " or more" : ""} open issues`}
        >
          {summary.total}
          {summary.truncated ? "+" : ""}
        </Text>
        {summary.truncated ? (
          <Text style={styles.muted}>
            Showing the {summary.total} most recently updated open issues. Older ones are not counted.
          </Text>
        ) : null}
      </View>
      <View style={styles.grid}>
        <Breakdown title="By state" rows={summary.byState} theme={theme} styles={styles} />
        <Breakdown title="By priority" rows={summary.byPriority} theme={theme} styles={styles} />
        <Breakdown title="By assignee" rows={summary.byAssignee} theme={theme} styles={styles} />
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          Recently updated
        </Text>
        {summary.recent.map((issue) => (
          <Pressable
            key={issue.id}
            accessibilityRole="link"
            accessibilityLabel={`${issue.identifier}, ${issue.title}. ${issue.state}, ${issue.priority}, ${issue.assignee ?? "unassigned"}. Opens in Linear`}
            style={styles.issue}
            onPress={() => void openExternal(issue.url)}
          >
            <Text style={styles.body} numberOfLines={2}>
              {issue.identifier} {issue.title}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {issue.state} · {issue.priority} · {issue.assignee ?? "Unassigned"}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export function DashboardScreen({ theme, layout }: PluginScreenProps) {
  const getDashboard = useRpc(getDashboardRpc);
  const styles = useStyles(theme, layout.compact);
  // Manual refresh only: no polling and no refetch on focus.
  const query = useQuery({
    queryKey: ["linear-dashboard", "summary"],
    queryFn: () => getDashboard({}),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const result = query.data;
  const busy = query.isFetching;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Linear issues
        </Text>
        <Text style={styles.muted}>
          Read-only view of open issues.
          {result?.status === "ready"
            ? ` Updated ${new Date(result.summary.fetchedAt).toLocaleTimeString()}.`
            : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? "Refreshing Linear issues" : "Refresh Linear issues"}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          style={[styles.button, busy ? { opacity: 0.6 } : null]}
          onPress={() => void query.refetch()}
        >
          <Text style={styles.buttonText}>{busy ? "Refreshing…" : "Refresh"}</Text>
        </Pressable>
      </View>

      {query.isPending ? (
        <ActivityIndicator accessibilityLabel="Loading Linear issues" color={theme.colors.accent} />
      ) : null}

      {query.isError ? (
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.danger}>Could not reach the Paseo daemon. Try refreshing.</Text>
        </View>
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

      {result?.status === "error" ? (
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.danger}>{result.message}</Text>
        </View>
      ) : null}

      {result?.status === "ready" ? (
        <Summary summary={result.summary} theme={theme} styles={styles} />
      ) : null}
    </ScrollView>
  );
}
