import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Catalog } from "../shared/dashboard";
import { filterProjects, type LinkEntry } from "../shared/links";
import { QuietButton } from "./parts";
import type { PluginTheme, Styles } from "./styles";

/** Everything the bar needs about the current workspace and its saved link. */
export interface WorkspaceBinding {
  localName: string;
  rootPath: string;
  link: LinkEntry | null;
  /** The linked project is no longer in the Linear catalog. */
  stale: boolean;
  /** The saved links are still loading or unreadable, so changes are disabled. */
  loading: boolean;
  saving: boolean;
  error: string | null;
  onLink(project: { id: string; name: string }): void;
  onUnlink(): void;
}

function Pair({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={{ gap: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.small}>{label}</Text>
      <Text numberOfLines={1} style={styles.rowTitle}>
        {value}
      </Text>
    </View>
  );
}

export function WorkspaceBar({
  binding,
  catalog,
  teamId,
  theme,
  styles,
}: {
  binding: WorkspaceBinding;
  catalog: Catalog | null;
  teamId: string | undefined;
  theme: PluginTheme;
  styles: Styles;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const busy = binding.loading || binding.saving;
  const projects = catalog ? filterProjects(catalog.projects, query, teamId) : [];
  const close = () => {
    setPicking(false);
    setQuery("");
  };

  return (
    <View style={[styles.panelRow, styles.panelFirst]}>
      <Pair label="This workspace" value={binding.localName || "Unnamed project"} styles={styles} />
      <Text numberOfLines={1} ellipsizeMode="middle" style={styles.small}>
        {binding.rootPath}
      </Text>
      <Pair
        label="Linear project"
        value={binding.link ? binding.link.projectName : "Not linked"}
        styles={styles}
      />
      {binding.link && !binding.stale ? (
        <Text style={styles.small}>Issues are filtered to this project.</Text>
      ) : null}
      {binding.stale ? (
        <Text style={styles.danger} accessibilityRole="alert">
          That project is no longer in Linear. Change or remove the link. The manual filter applies
          until then.
        </Text>
      ) : null}
      {!binding.link && !picking ? (
        <Text style={styles.small}>Link a Linear project to filter issues for this workspace.</Text>
      ) : null}

      <View style={styles.filterRow}>
        <QuietButton
          label={binding.link ? "Change" : "Link"}
          accessibilityLabel={
            binding.link ? "Change the linked Linear project" : "Link a Linear project"
          }
          disabled={busy || !catalog}
          onPress={() => (picking ? close() : setPicking(true))}
          styles={styles}
        />
        {binding.link ? (
          <QuietButton
            label="Unlink"
            accessibilityLabel="Unlink the Linear project from this workspace"
            disabled={busy}
            onPress={() => {
              close();
              binding.onUnlink();
            }}
            styles={styles}
          />
        ) : null}
        {binding.saving ? <Text style={styles.small}>Saving…</Text> : null}
      </View>
      {!catalog && !binding.loading ? (
        <Text style={styles.small}>Projects load once Linear is connected.</Text>
      ) : null}
      {binding.error ? (
        <Text style={styles.danger} accessibilityRole="alert">
          {binding.error}
        </Text>
      ) : null}

      {picking && catalog ? (
        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel="Search Linear projects"
            placeholder="Search projects"
            placeholderTextColor={theme.colors.foregroundMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            style={styles.input}
          />
          <ScrollView
            style={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {projects.length === 0 ? (
              <Text style={[styles.small, { padding: 12 }]}>No projects match.</Text>
            ) : null}
            {projects.map((project) => {
              const current = project.id === binding.link?.projectId;
              return (
                <Pressable
                  key={project.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${current ? "Linked project " : "Link to "}${project.name}`}
                  accessibilityState={{ selected: current, disabled: busy }}
                  disabled={busy}
                  style={[styles.row, current ? styles.rowSelected : null]}
                  onPress={() => {
                    close();
                    binding.onLink({ id: project.id, name: project.name });
                  }}
                >
                  <View
                    style={[
                      styles.rail,
                      { backgroundColor: current ? theme.colors.accent : "transparent" },
                    ]}
                  />
                  <View style={styles.rowBody}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {project.name}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
