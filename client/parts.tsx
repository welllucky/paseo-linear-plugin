import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { DashboardSummary, IssueRow } from "../shared/dashboard";
import { groupIssuesByState } from "../shared/summarize";
import type { PluginTheme, Styles } from "./styles";

const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

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
      hitSlop={HIT_SLOP}
      style={[
        styles.chip,
        selected ? styles.chipSelected : null,
        disabled ? { opacity: 0.6 } : null,
      ]}
      onPress={onPress}
    >
      <Text numberOfLines={1} style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuietButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
  styles,
}: {
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      style={[styles.buttonQuiet, disabled ? { opacity: 0.6 } : null]}
      onPress={onPress}
    >
      <Text style={styles.buttonQuietText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorNotice({
  message,
  styles,
  onRetry,
}: {
  message: string;
  styles: Styles;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <Text style={styles.danger}>{message}</Text>
      {onRetry ? <QuietButton label="Try again" onPress={onRetry} styles={styles} /> : null}
    </View>
  );
}

/** One horizontally scrolling line of chips with a short leading label. */
export function FilterRow({
  label,
  styles,
  children,
}: {
  label: string;
  styles: Styles;
  children: ReactNode;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, alignItems: "center", paddingVertical: 2 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Linear state types, mapped onto theme colors. The legend always repeats the name in text. */
export function stateColor(type: string, theme: PluginTheme): string {
  switch (type) {
    case "started":
      return theme.colors.accent;
    case "unstarted":
      return theme.colors.statusWarning;
    case "triage":
      return theme.colors.statusDanger;
    default:
      return theme.colors.foregroundMuted;
  }
}

/** Rail color for an issue row: only the two pressing priorities get a signal color. */
export function priorityColor(priority: string, theme: PluginTheme): string {
  if (priority === "Urgent") return theme.colors.statusDanger;
  if (priority === "High") return theme.colors.statusWarning;
  return "transparent";
}

const LEGEND_LIMIT = 4;
const INLINE_LIMIT = 3;

function inline(rows: { name: string; count: number }[], limit: number): string {
  if (rows.length === 0) return "None";
  const shown = rows.slice(0, limit).map((row) => `${row.name} ${row.count}`);
  const rest = rows.length - limit;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

/** Open total, a proportional state bar and a one-line read of priority and assignee. */
export function Overview({
  summary,
  theme,
  styles,
}: {
  summary: DashboardSummary;
  theme: PluginTheme;
  styles: Styles;
}) {
  const total = `${summary.total}${summary.truncated ? "+" : ""}`;
  const legend = summary.byState.slice(0, LEGEND_LIMIT);
  const hidden = summary.byState.length - legend.length;
  return (
    <View style={[styles.panelRow, styles.panelFirst]}>
      <View style={styles.filterRow}>
        <Text
          style={styles.count}
          accessibilityLabel={`${total}${summary.truncated ? " or more" : ""} open issues`}
        >
          {total}
        </Text>
        <Text style={styles.small}>open issues</Text>
      </View>
      {summary.truncated ? (
        <Text style={styles.small}>
          Counting the {summary.total} most recently updated. Older ones are not included.
        </Text>
      ) : null}
      {summary.total > 0 ? (
        <>
          <View style={styles.stack} accessible={false}>
            {summary.byState.map((row) => (
              <View
                key={row.name}
                style={{ flex: row.count, backgroundColor: stateColor(row.type, theme) }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {legend.map((row) => (
              <View
                key={row.name}
                style={styles.legendItem}
                accessible
                accessibilityLabel={`${row.name}: ${row.count}`}
              >
                <View style={[styles.dot, { backgroundColor: stateColor(row.type, theme) }]} />
                <Text style={styles.small} numberOfLines={1}>
                  {row.name} {row.count}
                </Text>
              </View>
            ))}
            {hidden > 0 ? <Text style={styles.small}>+{hidden} more states</Text> : null}
          </View>
          <Text style={styles.small} numberOfLines={2}>
            Priority: {inline(summary.byPriority, INLINE_LIMIT + 2)}
          </Text>
          <Text style={styles.small} numberOfLines={2}>
            Assignees: {inline(summary.byAssignee, INLINE_LIMIT)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

export function IssueList({
  issues,
  stateOrder,
  selectedId,
  onSelect,
  styles,
  theme,
  emptyHint,
}: {
  issues: IssueRow[];
  stateOrder: DashboardSummary["byState"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  styles: Styles;
  theme: PluginTheme;
  emptyHint?: ReactNode;
}) {
  const groups = groupIssuesByState(issues, stateOrder);
  return (
    <View>
      <View style={[styles.panelRow, styles.headerRow]}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          Recently updated
        </Text>
        <Text style={styles.small}>{issues.length} shown</Text>
      </View>
      {issues.length === 0 ? (
        <View style={styles.panelRow}>
          <Text style={styles.body}>No open issues match these filters.</Text>
          {emptyHint}
        </View>
      ) : null}
      {groups.map((group) => (
        <View key={group.name}>
          <View style={styles.groupHeader} accessibilityRole="header">
            <View style={styles.groupTitle}>
              <View style={[styles.dot, { backgroundColor: stateColor(group.type, theme) }]} />
              <Text numberOfLines={1} style={styles.groupName}>
                {group.name}
              </Text>
            </View>
            <Text style={styles.small}>{group.issues.length}</Text>
          </View>
          {group.issues.map((issue) => {
            const selected = issue.id === selectedId;
            return (
              <Pressable
                key={issue.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${issue.identifier}, ${issue.title}. ${issue.state}, ${issue.priority}, ${issue.assignee ?? "unassigned"}. Shows details`}
                style={[styles.row, selected ? styles.rowSelected : null]}
                onPress={() => onSelect(issue.id)}
              >
                <View
                  style={[
                    styles.rail,
                    {
                      backgroundColor: selected
                        ? theme.colors.accent
                        : priorityColor(issue.priority, theme),
                    },
                  ]}
                />
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {issue.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowId}>
                    {issue.identifier} · {issue.priority} · {issue.assignee ?? "Unassigned"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
