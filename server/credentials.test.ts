import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  createCredentialStore,
  defaultTokenPath,
  InvalidTokenError,
  normalizeToken,
  redact,
} from "./credentials";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "linear-credentials-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("a saved token wins over LINEAR_API_KEY, which stays the fallback", async () => {
  const path = join(dir, "nested", "token");
  const store = createCredentialStore({ path, env: { LINEAR_API_KEY: " lin_api_env " } });
  assert.deepEqual(await store.resolve(), { token: "lin_api_env", source: "environment" });

  await store.save("  lin_api_saved  ");
  assert.deepEqual(await store.resolve(), { token: "lin_api_saved", source: "settings" });

  await store.clear();
  assert.deepEqual(await store.resolve(), { token: "lin_api_env", source: "environment" });
});

test("nothing is configured without a saved token or the environment variable", async () => {
  const store = createCredentialStore({ path: join(dir, "token"), env: {} });
  assert.equal(await store.resolve(), null);
  await store.clear();
  assert.equal(
    await createCredentialStore({ path: join(dir, "t"), env: { LINEAR_API_KEY: "  " } }).resolve(),
    null,
  );
});

test("the token file is private to the owner", async () => {
  const path = join(dir, "private", "token");
  await createCredentialStore({ path, env: {} }).save("lin_api_saved");
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await stat(join(dir, "private"))).mode & 0o777, 0o700);
  assert.equal(await readFile(path, "utf8"), "lin_api_saved\n");
});

test("malformed tokens are rejected without echoing the input", () => {
  for (const bad of ["", "   ", "lin api", "lin_api_\u0000x", "é", "x".repeat(600)]) {
    assert.throws(
      () => normalizeToken(bad),
      (error) => error instanceof InvalidTokenError && !error.message.includes("lin_api_"),
    );
  }
  assert.equal(normalizeToken(" lin_api_ok "), "lin_api_ok");
});

test("redact removes the known token and anything shaped like a Linear key", () => {
  assert.equal(
    redact("bad abc123 and lin_api_Zz9-x_", ["abc123"]),
    "bad [redacted] and [redacted]",
  );
  assert.equal(redact("lin_oauth_abc failed"), "[redacted] failed");
  assert.equal(redact("nothing here", [""]), "nothing here");
});

test("the default location is inside the daemon home", () => {
  assert.equal(
    defaultTokenPath({ PASEO_HOME: "/data/paseo" }),
    "/data/paseo/plugin-data/linear-dashboard/token",
  );
});
