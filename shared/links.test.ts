import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterProjects,
  findLink,
  type LinksDocument,
  normalizeRootPath,
  resolveProjectFilter,
  withLink,
  withoutLink,
  workspaceLinks,
} from "./links";

const entry = { projectId: "p1", projectName: "Billing", localName: "api" };
const empty: LinksDocument = { links: {} };

test("root paths normalize to one key per project", () => {
  assert.equal(normalizeRootPath("/home/a/api/"), "/home/a/api");
  assert.equal(normalizeRootPath("  /home/a/api  "), "/home/a/api");
  assert.equal(normalizeRootPath("C:\\work\\api\\"), "C:/work/api");
  assert.equal(normalizeRootPath("/"), "/");
  assert.equal(normalizeRootPath("  "), "");
});

test("link and unlink are immutable and keyed by the normalized root", () => {
  const linked = withLink(empty, "/home/a/api/", entry);
  assert.deepEqual(empty, { links: {} });
  assert.deepEqual(findLink(linked, "/home/a/api"), entry);
  assert.equal(findLink(linked, "/home/a/other"), null);

  const changed = withLink(linked, "/home/a/api", {
    ...entry,
    projectId: "p2",
    projectName: "Ops",
  });
  assert.equal(findLink(changed, "/home/a/api/")?.projectId, "p2");
  assert.equal(Object.keys(changed.links).length, 1);

  const other = withLink(changed, "/home/a/web", entry);
  const unlinked = withoutLink(other, "/home/a/api/");
  assert.equal(findLink(unlinked, "/home/a/api"), null);
  assert.deepEqual(findLink(unlinked, "/home/a/web"), entry);
  assert.deepEqual(withoutLink(empty, "/nope"), { links: {} });
});

test("an empty or blank root never links or matches", () => {
  assert.deepEqual(withLink(empty, "  ", entry), empty);
  assert.equal(findLink(withLink(empty, "/a", entry), ""), null);
});

test("inherited object keys are not treated as links", () => {
  assert.equal(findLink(empty, "constructor"), null);
  assert.equal(findLink(empty, "__proto__"), null);
});

test("the stored document holds only ids and names and accepts an empty file", () => {
  const parsed = workspaceLinks.schema.parse({});
  assert.deepEqual(parsed, { links: {} });
  const linked = withLink(parsed, "/a", entry);
  assert.deepEqual(Object.keys(linked.links["/a"]).sort(), [
    "localName",
    "projectId",
    "projectName",
  ]);
  assert.equal(workspaceLinks.scope, "host");
  assert.equal(
    workspaceLinks.schema.safeParse({ links: { "/a": { projectId: "" } } }).success,
    false,
  );
});

test("a link filters automatically and wins over the manual project", () => {
  assert.deepEqual(
    resolveProjectFilter({ link: entry, manualProjectId: "manual", catalogProjectIds: ["p1"] }),
    { projectId: "p1", source: "link", stale: false },
  );
  // Before the catalog loads the link is applied at once, so the first request is already filtered.
  assert.deepEqual(
    resolveProjectFilter({ link: entry, manualProjectId: undefined, catalogProjectIds: null }),
    { projectId: "p1", source: "link", stale: false },
  );
});

test("without a link the manual filter is preserved", () => {
  assert.deepEqual(
    resolveProjectFilter({ link: null, manualProjectId: "m", catalogProjectIds: ["m"] }),
    { projectId: "m", source: "manual", stale: false },
  );
  assert.deepEqual(
    resolveProjectFilter({ link: null, manualProjectId: undefined, catalogProjectIds: [] }),
    { projectId: undefined, source: "none", stale: false },
  );
});

test("a link to a project missing from the loaded catalog is stale and not applied", () => {
  assert.deepEqual(
    resolveProjectFilter({ link: entry, manualProjectId: "m", catalogProjectIds: ["m", "x"] }),
    { projectId: "m", source: "manual", stale: true },
  );
});

test("project search matches names case-insensitively and respects the team", () => {
  const projects = [
    { id: "1", name: "Billing API", teamIds: ["t1"] },
    { id: "2", name: "billing web", teamIds: ["t2"] },
    { id: "3", name: "Ops", teamIds: ["t1", "t2"] },
  ];
  assert.deepEqual(
    filterProjects(projects, " BILL ").map((p) => p.id),
    ["1", "2"],
  );
  assert.deepEqual(
    filterProjects(projects, "", "t1").map((p) => p.id),
    ["1", "3"],
  );
  assert.deepEqual(filterProjects(projects, "zzz"), []);
});
