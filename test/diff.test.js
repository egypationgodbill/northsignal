import { test } from "node:test";
import assert from "node:assert/strict";
import { diffItems } from "../src/diff.js";
import { renderDigestMarkdown } from "../src/digest.js";

const a = { id: "1", source: "s", title: "Item A", url: "https://x/a" };
const b = { id: "2", source: "s", title: "Item B", url: "https://x/b" };
const bEdited = { ...b, title: "Item B (revised)" };
const c = { id: "3", source: "s", title: "Item C", url: "https://x/c" };

test("classifies added, changed, and removed", () => {
  const { added, changed, removed } = diffItems([a, b], [bEdited, c]);
  assert.deepEqual(added.map((i) => i.id), ["3"]);
  assert.deepEqual(changed.map((i) => i.id), ["2"]);
  assert.deepEqual(removed.map((i) => i.id), ["1"]);
});

test("empty previous makes everything added", () => {
  const { added, changed } = diffItems([], [a, b]);
  assert.equal(added.length, 2);
  assert.equal(changed.length, 0);
});

test("identical snapshots produce no diff", () => {
  const { added, changed, removed } = diffItems([a, b], [a, b]);
  assert.equal(added.length + changed.length + removed.length, 0);
});

test("digest reports a quiet run and surfaces errors under Sources", () => {
  const md = renderDigestMarkdown("2026-06-04", [
    { key: "s1", name: "Source One", added: [], changed: [] },
    { key: "s2", name: "Source Two", added: [], changed: [], error: "HTTP 503" },
  ]);
  assert.match(md, /No changes since the last run/);
  assert.match(md, /## Sources/);
  assert.match(md, /⚠️ \*\*Source Two\*\* — HTTP 503/);
});

test("digest lists items by theme with their source attribution", () => {
  const md = renderDigestMarkdown("2026-06-04", [
    { key: "s1", name: "Source One", added: [a], changed: [bEdited] },
  ]);
  assert.match(md, /## By theme/);
  assert.match(md, /🆕 \[Item A\]\(https:\/\/x\/a\) — _Source One_/);
  assert.match(md, /✏️ \[Item B \(revised\)\].*_Source One_/);
});
