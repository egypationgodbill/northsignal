import { readFile } from "node:fs/promises";
import { fetchPage } from "./fetch.js";
import { extractItems } from "./extract.js";
import { diffItems } from "./diff.js";
import { readJson, writeJson, writeText } from "./store.js";
import { renderDigestMarkdown } from "./digest.js";
import { renderSiteHtml } from "./site.js";

const MAX_ISSUES = 50; // keep the archive bounded

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const sources = JSON.parse(await readFile("sources.json", "utf8"));

  const perSource = [];
  for (const source of sources) {
    perSource.push(await scrapeSource(source));
  }

  // 1. Newsletter digest for this run.
  const markdown = renderDigestMarkdown(today, perSource);
  await writeText(`data/digests/${today}.md`, markdown);

  // 2. Archive of issues (single source of truth for the site).
  const counts = {
    new: perSource.reduce((n, s) => n + s.added.length, 0),
    changed: perSource.reduce((n, s) => n + s.changed.length, 0),
  };
  const existing = await readJson("data/issues.json", []);
  const issues = [
    { date: today, counts, perSource },
    ...existing.filter((i) => i.date !== today),
  ].slice(0, MAX_ISSUES);
  await writeJson("data/issues.json", issues);

  // 3. Static viewer.
  await writeText("site/index.html", renderSiteHtml(issues));

  console.log(
    `\nDigest: data/digests/${today}.md` +
      `\nSite:   site/index.html (${issues.length} issue(s))` +
      `\nTotals: ${counts.new} new, ${counts.changed} updated`
  );
}

// Scrape one source, never throwing — failures are recorded into the result.
async function scrapeSource(source) {
  try {
    const html = await fetchPage(source.url);
    const items = extractItems(html, source);

    const snapPath = `data/snapshots/${source.key}.json`;
    const prev = await readJson(snapPath, { items: [] });
    const { added, changed } = diffItems(prev.items, items);
    await writeJson(snapPath, { fetchedAt: new Date().toISOString(), items });

    console.log(
      `${source.key}: ${items.length} items (${added.length} new, ${changed.length} changed)`
    );
    return { key: source.key, name: source.name, added, changed, total: items.length };
  } catch (err) {
    const message = String(err?.message ?? err);
    console.error(`${source.key}: ERROR ${message}`);
    return { key: source.key, name: source.name, added: [], changed: [], error: message };
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
