import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  type SettingsInputHandle,
  SettingsRow,
  SettingsSection,
} from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Text } from "react-native";
import {
  checkConnectionRpc,
  clearTokenRpc,
  describeTokenStatus,
  getTokenStatusRpc,
  saveTokenRpc,
  type TokenStatus,
} from "../shared/dashboard";

const DAEMON_UNREACHABLE = "Could not reach the Paseo daemon.";

export function SettingsScreen({ theme }: PluginSurfaceProps) {
  const getStatus = useRpc(getTokenStatusRpc);
  const saveToken = useRpc(saveTokenRpc);
  const clearToken = useRpc(clearTokenRpc);
  const checkConnection = useRpc(checkConnectionRpc);
  const queryClient = useQueryClient();
  const input = useRef<SettingsInputHandle>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState(null as { text: string; error: boolean } | null);

  const statusKey = ["linear-dashboard", "token-status"];
  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: () => getStatus({}),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const status: TokenStatus | null =
    statusQuery.data?.status === "ready" ? statusQuery.data.data : null;

  /** Other Linear views hold data fetched with the old key, so reload them. */
  const refreshViews = () => queryClient.invalidateQueries({ queryKey: ["linear-dashboard"] });

  const save = useMutation({
    mutationFn: (token: string) => saveToken({ token }),
    onSuccess: (outcome) => {
      if (outcome.status === "ready") {
        input.current?.replaceText("");
        setDraft("");
        queryClient.setQueryData(statusKey, outcome);
        setNotice({ text: "Key saved on the daemon.", error: false });
        void refreshViews();
      } else {
        setNotice({ text: outcome.message, error: true });
      }
    },
    onError: () => setNotice({ text: DAEMON_UNREACHABLE, error: true }),
  });
  const clear = useMutation({
    mutationFn: () => clearToken({}),
    onSuccess: (outcome) => {
      if (outcome.status === "ready") {
        queryClient.setQueryData(statusKey, outcome);
        setNotice({ text: "Saved key removed.", error: false });
        void refreshViews();
      } else {
        setNotice({ text: outcome.message, error: true });
      }
    },
    onError: () => setNotice({ text: DAEMON_UNREACHABLE, error: true }),
  });
  const check = useMutation({
    mutationFn: () => checkConnection({}),
    onSuccess: (outcome) => {
      if (outcome.status === "ready") {
        setNotice({ text: `Connected to Linear as ${outcome.data.viewer}.`, error: false });
      } else if (outcome.status === "error") {
        setNotice({ text: outcome.message, error: true });
      } else {
        setNotice({ text: "No key is set.", error: true });
      }
    },
    onError: () => setNotice({ text: DAEMON_UNREACHABLE, error: true }),
  });
  const busy = save.isPending || clear.isPending || check.isPending;

  const statusText = statusQuery.isPending
    ? "Checking…"
    : statusQuery.isError || statusQuery.data?.status === "error"
      ? "Could not read the key status."
      : status
        ? describeTokenStatus(status)
        : "Unknown";

  return (
    <SettingsSection title="Linear API key">
      <SettingsCard>
        <SettingsRow
          label="Status"
          hint="The key is stored on the daemon machine. The app only learns whether one is set."
        >
          <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.foreground }}>
            {statusText}
          </Text>
        </SettingsRow>
        <SettingsInput
          ref={input}
          label="API key"
          hint="Create a personal API key in Linear under Settings, Security and access."
          placeholder="lin_api_..."
          secureTextEntry
          disabled={busy}
          onChangeText={setDraft}
        />
        <SettingsAction
          label="Save key"
          hint="A saved key takes precedence over LINEAR_API_KEY."
          actionLabel={save.isPending ? "Saving…" : "Save"}
          disabled={busy || draft.trim().length === 0}
          onPress={() => {
            setNotice(null);
            save.mutate(draft);
          }}
        />
        <SettingsAction
          label="Test connection"
          actionLabel={check.isPending ? "Testing…" : "Test"}
          disabled={busy || !status?.configured}
          onPress={() => {
            setNotice(null);
            check.mutate();
          }}
        />
        <SettingsAction
          label="Remove saved key"
          hint="LINEAR_API_KEY, if set on the daemon, is used afterwards."
          actionLabel={clear.isPending ? "Removing…" : "Remove"}
          disabled={busy || status?.source !== "settings"}
          onPress={() => {
            setNotice(null);
            clear.mutate();
          }}
        />
      </SettingsCard>
      {notice ? (
        <Text
          accessibilityRole={notice.error ? "alert" : undefined}
          accessibilityLiveRegion="polite"
          style={{
            color: notice.error ? theme.colors.statusDanger : theme.colors.foregroundMuted,
          }}
        >
          {notice.text}
        </Text>
      ) : null}
    </SettingsSection>
  );
}
