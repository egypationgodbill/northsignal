import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

// Government of Canada pages use the WET toolkit; real content lives in `main`
// or `#wb-cont`. We harvest links there and let per-source filters cut noise.
const DEFAULT_LINK_SELECTOR = "main a, [role='main'] a, #wb-cont a";
const DEFAULT_MIN_TITLE = 15;

// Parse a page into a list of candidate items: { id, source, title, url }.
// `source` config: { key, url, linkSelector?, include?[], exclude?[], minTitle? }
export function extractItems(html, source) {
  const $ = cheerio.load(html);
  const base = new URL(source.url);

  let links = $(source.linkSelector ?? DEFAULT_LINK_SELECTOR);
  if (links.length === 0) links = $("a"); // fall back to whole page

  const include = (source.include ?? []).map((p) => new RegExp(p, "i"));
  const exclude = (source.exclude ?? []).map((p) => new RegExp(p, "i"));
  const minTitle = source.minTitle ?? DEFAULT_MIN_TITLE;

  const items = [];
  links.each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href");
    if (!title || title.length < minTitle || !href) return;

    let url;
    try {
      url = new URL(href, base).toString();
    } catch {
      return; // malformed href
    }
    if (!url.startsWith("http")) return;

    const hay = `${title} ${url}`;
    if (include.length && !include.some((r) => r.test(hay))) return;
    if (exclude.some((r) => r.test(hay))) return;

    items.push({ id: hashId(source.key, url), source: source.key, title, url });
  });

  return dedupeByUrl(items);
}

function hashId(key, url) {
  return createHash("sha1").update(`${key}:${url}`).digest("hex").slice(0, 12);
}

function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.url) ? false : seen.add(i.url)));
}
