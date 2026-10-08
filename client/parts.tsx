import { Pressable, Text, View } from "react-native";
import type { DashboardSummary, IssueRow } from "../shared/dashboard";
import type { Styles } from "../shared/styles-type";
import type { PluginTheme } from "./styles";

export function Chip({
  label,
  selected,
  disabled,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={[
        styles.chip,
        selected ? styles.chipSelected : null,
        disabled ? { opacity: 0.6 } : null,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export function ErrorNotice({ message, styles }: { message: string; styles: Styles }) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.danger}>{message}</Text>
    </View>
  );
}

export function Breakdown({
  title,
  rows,
  theme,
  styles,
}: {
  title: string;
  rows: { name: string; count: number }[];
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

export function Totals({
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
            Showing the {summary.total} most recently updated open issues. Older ones are not
            counted.
          </Text>
        ) : null}
      </View>
      <View style={styles.grid}>
        <Breakdown title="By state" rows={summary.byState} theme={theme} styles={styles} />
        <Breakdown title="By priority" rows={summary.byPriority} theme={theme} styles={styles} />
        <Breakdown title="By assignee" rows={summary.byAssignee} theme={theme} styles={styles} />
      </View>
    </>
  );
}

export function IssueList({
  issues,
  selectedId,
  onSelect,
  styles,
}: {
  issues: IssueRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  styles: Styles;
}) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        Recently updated
      </Text>
      {issues.length === 0 ? (
        <Text style={styles.muted}>No open issues match this filter.</Text>
      ) : null}
      {issues.map((issue) => {
        const selected = issue.id === selectedId;
        return (
          <Pressable
            key={issue.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${issue.identifier}, ${issue.title}. ${issue.state}, ${issue.priority}, ${issue.assignee ?? "unassigned"}. Shows details`}
            style={[styles.issue, selected ? styles.issueSelected : null]}
            onPress={() => onSelect(issue.id)}
          >
            <Text style={styles.body} numberOfLines={2}>
              {issue.identifier} {issue.title}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {issue.state} · {issue.priority} · {issue.assignee ?? "Unassigned"}
              {issue.project ? ` · ${issue.project}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
