import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractItems } from "../src/extract.js";

const html = await readFile(new URL("./fixtures/sample.html", import.meta.url), "utf8");
const source = { key: "demo", url: "https://news.example.gc.ca/list" };

test("extracts only valid main-region items, deduped", () => {
  const items = extractItems(html, source);
  // nav/footer excluded (outside <main>); "Short" too short; missing-href skipped;
  // duplicate collapsed -> 2 items.
  assert.equal(items.length, 2);
});

test("resolves relative URLs against the source base", () => {
  const items = extractItems(html, source);
  const urls = items.map((i) => i.url);
  assert.ok(urls.includes("https://news.example.gc.ca/news/ai-missions-program-launch"));
  assert.ok(urls.includes("https://example.gc.ca/news/lift-program"));
});

test("assigns stable, distinct ids", () => {
  const a = extractItems(html, source);
  const b = extractItems(html, source);
  assert.deepEqual(a.map((i) => i.id), b.map((i) => i.id)); // stable across runs
  assert.equal(new Set(a.map((i) => i.id)).size, a.length); // distinct
});

test("include filter narrows to matching items", () => {
  const items = extractItems(html, { ...source, include: ["LIFT|financing"] });
  assert.equal(items.length, 1);
  assert.match(items[0].title, /LIFT/);
});

test("exclude filter drops matching items", () => {
  const items = extractItems(html, { ...source, exclude: ["healthcare"] });
  assert.equal(items.length, 1);
  assert.doesNotMatch(items[0].title, /healthcare/i);
});
