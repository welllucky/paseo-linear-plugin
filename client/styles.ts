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
      chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
      chip: {
        minHeight: 44,
        paddingHorizontal: 12,
        justifyContent: "center" as const,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface0,
      },
      chipSelected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
      chipText: { color: theme.colors.foreground, fontSize: 13 },
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
