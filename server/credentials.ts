import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { TokenSource } from "../shared/dashboard";

export interface Credentials {
  token: string;
  source: Exclude<TokenSource, "none">;
}

export interface CredentialStore {
  /** The token to use now: the saved one first, then LINEAR_API_KEY. Null when neither is set. */
  resolve(): Promise<Credentials | null>;
  save(token: string): Promise<void>;
  /** Removes the saved token only. LINEAR_API_KEY is left alone and stays the fallback. */
  clear(): Promise<void>;
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTokenError";
  }
}

const MAX_TOKEN_LENGTH = 512;

/** Trims and checks the shape of a pasted token without ever echoing it back. */
export function normalizeToken(raw: string): string {
  const token = raw.trim();
  if (!token) throw new InvalidTokenError("Enter a Linear API key");
  if (token.length > MAX_TOKEN_LENGTH) throw new InvalidTokenError("That API key is too long");
  if (/\s/.test(token) || /[^\x21-\x7e]/.test(token)) {
    throw new InvalidTokenError("An API key cannot contain spaces or special characters");
  }
  return token;
}

const TOKEN_LIKE = /lin_(?:api|oauth)_[A-Za-z0-9_-]+/g;

/** Removes the live token and anything shaped like a Linear key from text bound for the client or logs. */
export function redact(text: string, known: readonly string[] = []): string {
  let out = text;
  for (const secret of known) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out.replace(TOKEN_LIKE, "[redacted]");
}

function paseoHome(env: NodeJS.ProcessEnv): string {
  return env.PASEO_HOME?.trim() || join(homedir(), ".paseo");
}

/** Where the saved token lives, inside the daemon's own data directory. */
export function defaultTokenPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(paseoHome(env), "plugin-data", "linear-dashboard", "token");
}

/**
 * File-backed store. The token is written with owner-only permissions and is only ever read
 * by the daemon process; nothing here is exposed to the app.
 */
export function createCredentialStore(
  options: { path?: string; env?: NodeJS.ProcessEnv } = {},
): CredentialStore {
  const env = options.env ?? process.env;
  const path = options.path ?? defaultTokenPath(env);

  async function readSaved(): Promise<string | null> {
    try {
      const value = (await readFile(path, "utf8")).trim();
      return value || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  // Saves and clears run one at a time in call order, so the last request wins and the
  // status a caller reads afterwards reflects the file as that caller left it.
  let queue: Promise<unknown> = Promise.resolve();
  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work, work);
    queue = run.catch(() => {});
    return run;
  }

  return {
    async resolve() {
      const saved = await readSaved();
      if (saved) return { token: saved, source: "settings" };
      const fromEnv = (env.LINEAR_API_KEY ?? "").trim();
      return fromEnv ? { token: fromEnv, source: "environment" } : null;
    },
    async save(raw) {
      // Validate before queueing so a bad token fails fast and never delays the others.
      const token = normalizeToken(raw);
      return serialized(async () => {
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        // A name unique to this call: overlapping writers must never share a temporary file.
        const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, `${token}\n`, { mode: 0o600 });
          await chmod(temporary, 0o600);
          await rename(temporary, path);
        } catch (error) {
          await rm(temporary, { force: true });
          throw error;
        }
      });
    },
    clear() {
      return serialized(() => rm(path, { force: true }));
    },
  };
}
