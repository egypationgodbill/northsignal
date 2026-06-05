// Rebuild site/index.html (and re-render the latest digest) from stored
// issues — no scraping. Use this to iterate on presentation quickly:
//   npm run render
import { readJson, writeText } from "./store.js";
import { renderSiteHtml } from "./site.js";
import { renderDigestMarkdown } from "./digest.js";

async function main() {
  const issues = await readJson("data/issues.json", []);
  if (issues.length === 0) {
    console.error("No data/issues.json — run `npm run scrape` first.");
    process.exit(1);
  }

  await writeText("site/index.html", renderSiteHtml(issues));

  const latest = issues[0];
  await writeText(`data/digests/${latest.date}.md`, renderDigestMarkdown(latest.date, latest.perSource));

  console.log(`Rendered site/index.html and data/digests/${latest.date}.md from ${issues.length} issue(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
