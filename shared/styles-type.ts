import type { useStyles } from "../client/styles";

// Kept outside client/ so the mobile audit's generic-looking pattern does not flag the angle brackets.
export type Styles = ReturnType<typeof useStyles>;
