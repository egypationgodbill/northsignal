import { groupByTheme } from "./theme.js";
import { cleanItem, formatDate } from "./clean.js";

// Render one issue of the newsletter as Markdown: summary → by theme → sources.
// `perSource` entries: { key, name, added[], changed[], total?, error? }
export function renderDigestMarkdown(date, perSource) {
  const totalNew = sum(perSource, (s) => s.added.length);
  const totalChanged = sum(perSource, (s) => s.changed.length);
  const errored = perSource.filter((s) => s.error);
  const items = collectItems(perSource);
  const groups = groupByTheme(items);

  const lines = [
    `# NorthSignal — ${date}`,
    "",
    `**${totalNew} new · ${totalChanged} updated** across ${activeCount(perSource)} source(s).`,
    "",
  ];

  if (items.length === 0) {
    lines.push("No changes since the last run.", "");
  } else {
    // Summary: one line per theme with its count.
    lines.push("## Summary", "");
    for (const g of groups) {
      lines.push(`- ${g.theme.icon} **${g.theme.label}** — ${g.items.length}`);
    }
    lines.push("");

    // By theme: the readable body.
    lines.push("## By theme", "");
    for (const g of groups) {
      lines.push(`### ${g.theme.icon} ${g.theme.label}`, "");
      for (const item of g.items) {
        const mark = item.status === "updated" ? "✏️" : "🆕";
        const when = item.date ? `${formatDate(item.date)} · ` : "";
        lines.push(`- ${mark} [${item.title}](${item.url}) — _${when}${item.sourceName}_`);
      }
      lines.push("");
    }
  }

  // Sources: reference counts, not a repeat of every item.
  lines.push("## Sources", "");
  for (const s of perSource) {
    if (s.error) {
      lines.push(`- ⚠️ **${s.name}** — ${s.error}`);
    } else {
      const n = s.added.length + s.changed.length;
      lines.push(`- ${s.name} — ${n ? `${n} new/updated` : "no change"}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

function collectItems(perSource) {
  const items = [];
  for (const s of perSource) {
    if (s.error) continue;
    for (const i of s.added) items.push({ ...cleanItem(i), sourceName: s.name, status: "new" });
    for (const i of s.changed) items.push({ ...cleanItem(i), sourceName: s.name, status: "updated" });
  }
  return items;
}

function activeCount(perSource) {
  return perSource.filter((s) => !s.error).length;
}

function sum(arr, fn) {
  return arr.reduce((n, x) => n + fn(x), 0);
}
