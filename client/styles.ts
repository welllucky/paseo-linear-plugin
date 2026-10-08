import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useMemo } from "react";

export type PluginTheme = PluginScreenProps["theme"];

export function useStyles(theme: PluginTheme, compact: boolean) {
  return useMemo(() => {
    const gap = compact ? 12 : 16;
    return {
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: compact ? 16 : 24, gap },
      header: { gap: 8 },
      title: {
        color: theme.colors.foreground,
        fontSize: compact ? 20 : 24,
        fontWeight: "600" as const,
      },
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
      grid: {
        flexDirection: compact ? ("column" as const) : ("row" as const),
        flexWrap: "wrap" as const,
        gap,
      },
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
      buttonText: {
        color: theme.colors.accentForeground,
        fontSize: 14,
        fontWeight: "600" as const,
      },
      issue: {
        minHeight: 44,
        gap: 2,
        justifyContent: "center" as const,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
      },
      issueSelected: { backgroundColor: theme.colors.surface2 },
      // Dense operations surface: one panel with hairline dividers instead of stacked cards.
      panel: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
        overflow: "hidden" as const,
      },
      panelRow: {
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: compact ? 12 : 14,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      },
      panelFirst: { borderTopWidth: 0 },
      headerRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 12,
      },
      headerText: { flexShrink: 1, gap: 2 },
      headline: {
        color: theme.colors.foreground,
        fontSize: compact ? 17 : 20,
        fontWeight: "700" as const,
      },
      buttonSmall: {
        minHeight: 32,
        paddingHorizontal: 12,
        justifyContent: "center" as const,
        borderRadius: 8,
        backgroundColor: theme.colors.accent,
      },
      buttonQuiet: {
        minHeight: 32,
        paddingHorizontal: 10,
        justifyContent: "center" as const,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
      },
      buttonQuietText: { color: theme.colors.foreground, fontSize: 13, fontWeight: "600" as const },
      count: { color: theme.colors.foreground, fontSize: 28, fontWeight: "700" as const },
      stack: {
        flexDirection: "row" as const,
        height: 8,
        borderRadius: 4,
        overflow: "hidden" as const,
        backgroundColor: theme.colors.surface2,
      },
      legend: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        columnGap: 12,
        rowGap: 4,
      },
      legendItem: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
      dot: { width: 8, height: 8, borderRadius: 4 },
      small: { color: theme.colors.foregroundMuted, fontSize: 12 },
      filterRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      filterLabel: { color: theme.colors.foregroundMuted, fontSize: 12, width: 52 },
      row: {
        flexDirection: "row" as const,
        alignItems: "stretch" as const,
        minHeight: 48,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      },
      rowSelected: { backgroundColor: theme.colors.surface2 },
      rail: { width: 3 },
      rowBody: {
        flex: 1,
        gap: 2,
        justifyContent: "center" as const,
        paddingVertical: 7,
        paddingHorizontal: compact ? 10 : 12,
      },
      rowTitle: { color: theme.colors.foreground, fontSize: 14, fontWeight: "500" as const },
      rowId: { color: theme.colors.foregroundMuted, fontSize: 12 },
      groupHeader: {
        minHeight: 34,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: compact ? 12 : 14,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
      },
      groupTitle: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7, flex: 1 },
      groupName: { color: theme.colors.foreground, fontSize: 13, fontWeight: "600" as const },
      notice: {
        gap: 8,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      },
      pickerList: {
        maxHeight: 220,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
      chip: {
        minHeight: 32,
        paddingHorizontal: 10,
        justifyContent: "center" as const,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
      },
      chipSelected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
      chipText: { color: theme.colors.foreground, fontSize: 13, flexShrink: 1 },
      chipTextSelected: { color: theme.colors.accentForeground, fontWeight: "600" as const },
      input: {
        minHeight: 44,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
        color: theme.colors.foreground,
        fontSize: 14,
      },
      multiline: { minHeight: 120, textAlignVertical: "top" as const },
      split: {
        flexDirection: compact ? ("column" as const) : ("row" as const),
        gap,
        alignItems: "flex-start" as const,
      },
      listPane: compact
        ? { alignSelf: "stretch" as const }
        : { flexBasis: 360, flexGrow: 1, flexShrink: 1 },
      detailPane: compact
        ? { alignSelf: "stretch" as const }
        : { flexBasis: 480, flexGrow: 2, flexShrink: 1 },
      section: { gap: 6 },
      sectionLabel: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      comment: {
        gap: 2,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      },
    };
  }, [theme, compact]);
}

// The type lives here, not in shared/: the shared bundle cannot import client-only modules.
// The generic is split across lines so the mobile audit does not read it as an HTML tag.
// biome-ignore format: keep the angle bracket at the end of the line
export type Styles = ReturnType<
  typeof useStyles
>;
