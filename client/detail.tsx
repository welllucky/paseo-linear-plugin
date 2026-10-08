import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { Catalog, IssueDetail, IssueUpdate } from "../shared/dashboard";
import { getIssueRpc, PRIORITIES, updateIssueRpc } from "../shared/dashboard";
import type { Styles } from "../shared/styles-type";
import { safeExternalUrl } from "../shared/urls";
import { Chip, ErrorNotice } from "./parts";
import type { PluginTheme } from "./styles";
import { openExternal } from "./web";

const NOT_CONNECTED = "Linear is not connected. Set LINEAR_API_KEY on the daemon.";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "None";
}

function Section({
  label,
  styles,
  children,
}: {
  label: string;
  styles: Styles;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function IssuePanel({
  issueId,
  catalog,
  theme,
  styles,
  onBack,
  onChanged,
}: {
  issueId: string;
  catalog: Catalog | null;
  theme: PluginTheme;
  styles: Styles;
  onBack: (() => void) | null;
  onChanged: () => void;
}) {
  const getIssue = useRpc(getIssueRpc);
  const updateIssue = useRpc(updateIssueRpc);
  const queryClient = useQueryClient();
  const queryKey = ["linear-dashboard", "issue", issueId];

  // Manual only: the detail loads when selected and after your own edits.
  const query = useQuery({
    queryKey,
    queryFn: () => getIssue({ id: issueId }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const issue = query.data?.status === "ready" ? query.data.data : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [failure, setFailure] = useState(null as string | null);
  useEffect(() => {
    if (!issue) return;
    setTitle(issue.title);
    setDescription(issue.description ?? "");
  }, [issue?.id, issue?.updatedAt]);
  useEffect(() => setFailure(null), [issueId]);

  const mutation = useMutation({
    mutationFn: (update: Omit<IssueUpdate, "id">) => updateIssue({ id: issueId, ...update }),
    onSuccess: (outcome) => {
      if (outcome.status === "ready") {
        setFailure(null);
        queryClient.setQueryData(queryKey, outcome);
        onChanged();
      } else {
        setFailure(outcome.status === "error" ? outcome.message : NOT_CONNECTED);
      }
    },
    onError: () => setFailure("Could not reach the Paseo daemon. The issue is unchanged."),
  });
  const busy = mutation.isPending;
  const apply = (update: Omit<IssueUpdate, "id">) => {
    setFailure(null);
    mutation.mutate(update);
  };

  const team = issue
    ? catalog?.teams.find((candidate) => candidate.id === issue.team?.id)
    : undefined;
  const dirty = issue ? title !== issue.title || description !== (issue.description ?? "") : false;

  return (
    <View style={styles.card}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the issue list"
          style={styles.button}
          onPress={onBack}
        >
          <Text style={styles.buttonText}>Back to list</Text>
        </Pressable>
      ) : null}

      {query.isPending ? (
        <ActivityIndicator accessibilityLabel="Loading issue" color={theme.colors.accent} />
      ) : null}
      {query.isError ? (
        <ErrorNotice
          message="Could not reach the Paseo daemon. Select the issue again."
          styles={styles}
        />
      ) : null}
      {query.data?.status === "error" ? (
        <ErrorNotice message={query.data.message} styles={styles} />
      ) : null}
      {query.data?.status === "not_configured" ? (
        <ErrorNotice message={NOT_CONNECTED} styles={styles} />
      ) : null}
      {failure ? <ErrorNotice message={failure} styles={styles} /> : null}

      {issue ? (
        <IssueBody
          issue={issue}
          team={team}
          title={title}
          description={description}
          dirty={dirty}
          busy={busy}
          styles={styles}
          onTitle={setTitle}
          onDescription={setDescription}
          onApply={apply}
        />
      ) : null}
    </View>
  );
}

function IssueBody({
  issue,
  team,
  title,
  description,
  dirty,
  busy,
  styles,
  onTitle,
  onDescription,
  onApply,
}: {
  issue: IssueDetail;
  team: Catalog["teams"][number] | undefined;
  title: string;
  description: string;
  dirty: boolean;
  busy: boolean;
  styles: Styles;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onApply: (update: Omit<IssueUpdate, "id">) => void;
}) {
  const issueUrl = safeExternalUrl(issue.url);
  return (
    <>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {issue.identifier}
      </Text>
      <Text style={styles.muted}>
        {[issue.team?.name, issue.project?.name].filter(Boolean).join(" · ") ||
          "No team or project"}
      </Text>
      <Text style={styles.muted}>
        Created {formatDate(issue.createdAt)} · Updated {formatDate(issue.updatedAt)} · Due{" "}
        {formatDate(issue.dueDate)}
      </Text>
      {issueUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${issue.identifier} in Linear`}
          style={styles.button}
          onPress={() => void openExternal(issueUrl)}
        >
          <Text style={styles.buttonText}>Open in Linear</Text>
        </Pressable>
      ) : null}

      <Section label="Title" styles={styles}>
        <TextInput
          accessibilityLabel="Issue title"
          style={styles.input}
          value={title}
          editable={!busy}
          onChangeText={onTitle}
        />
      </Section>
      <Section label="Description" styles={styles}>
        <TextInput
          accessibilityLabel="Issue description"
          style={[styles.input, styles.multiline]}
          value={description}
          editable={!busy}
          multiline
          onChangeText={onDescription}
        />
      </Section>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save title and description"
        accessibilityState={{ disabled: busy || !dirty, busy }}
        disabled={busy || !dirty}
        style={[styles.button, busy || !dirty ? { opacity: 0.6 } : null]}
        onPress={() =>
          onApply({
            ...(title !== issue.title ? { title } : {}),
            ...(description !== (issue.description ?? "") ? { description } : {}),
          })
        }
      >
        <Text style={styles.buttonText}>{busy ? "Saving…" : "Save changes"}</Text>
      </Pressable>

      <Section label="Status" styles={styles}>
        {team ? (
          <View style={styles.chips}>
            {team.states.map((state) => (
              <Chip
                key={state.id}
                label={state.name}
                selected={state.id === issue.state.id}
                disabled={busy}
                styles={styles}
                onPress={() => state.id !== issue.state.id && onApply({ stateId: state.id })}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.body}>{issue.state.name}</Text>
        )}
      </Section>
      <Section label="Priority" styles={styles}>
        <View style={styles.chips}>
          {PRIORITIES.map((priority) => (
            <Chip
              key={priority.value}
              label={priority.label}
              selected={priority.value === issue.priority}
              disabled={busy}
              styles={styles}
              onPress={() =>
                priority.value !== issue.priority && onApply({ priority: priority.value })
              }
            />
          ))}
        </View>
      </Section>
      <Section label="Assignee" styles={styles}>
        {team ? (
          <View style={styles.chips}>
            <Chip
              label="Unassigned"
              selected={issue.assignee === null}
              disabled={busy}
              styles={styles}
              onPress={() => issue.assignee !== null && onApply({ assigneeId: null })}
            />
            {team.members.map((member) => (
              <Chip
                key={member.id}
                label={member.name}
                selected={member.id === issue.assignee?.id}
                disabled={busy}
                styles={styles}
                onPress={() =>
                  member.id !== issue.assignee?.id && onApply({ assigneeId: member.id })
                }
              />
            ))}
          </View>
        ) : (
          <Text style={styles.body}>{issue.assignee?.name ?? "Unassigned"}</Text>
        )}
      </Section>

      <Section
        label={`Attachments (${issue.attachments.length}${issue.attachmentsTruncated ? "+" : ""})`}
        styles={styles}
      >
        {issue.attachments.length === 0 ? <Text style={styles.muted}>No attachments</Text> : null}
        {issue.attachments.map((attachment) => {
          const url = attachment.url;
          return (
            <Pressable
              key={attachment.id}
              accessibilityRole={url ? "link" : "text"}
              accessibilityLabel={
                url
                  ? `Open attachment ${attachment.title} in the browser`
                  : `Attachment ${attachment.title}, cannot be opened`
              }
              accessibilityState={{ disabled: !url }}
              disabled={!url}
              style={[styles.issue, url ? null : { opacity: 0.6 }]}
              onPress={() => url && void openExternal(url)}
            >
              <Text style={styles.body} numberOfLines={2}>
                {attachment.title}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {[attachment.source, attachment.subtitle, url ? null : "Unsupported address"]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Pressable>
          );
        })}
      </Section>

      <Section
        label={`Comments (${issue.comments.length}${issue.commentsTruncated ? "+" : ""})`}
        styles={styles}
      >
        {issue.comments.length === 0 ? <Text style={styles.muted}>No comments</Text> : null}
        {issue.comments.map((comment) => (
          <View key={comment.id} style={styles.comment} accessible>
            <Text style={styles.muted}>
              {comment.author ?? "Unknown"} · {formatDate(comment.createdAt)}
            </Text>
            <Text selectable style={styles.body}>
              {comment.body}
            </Text>
          </View>
        ))}
        {issue.commentsTruncated ? (
          <Text style={styles.muted}>Showing the first 50 comments.</Text>
        ) : null}
      </Section>
    </>
  );
}
