// Presentation-time cleanup for scraped titles. Many source pages put a date
// and/or category label in sibling spans inside the link, so .text() glues them
// onto the headline ("UpdatesUpdatesFeb 26, 2026Amii Monthly News"). We strip
// leading category labels, parse out a leading date, and return a clean title.
//
// This runs at render time (not in the scraper) so design tweaks don't require
// a re-scrape. The real fix for fully clean data is per-source selectors / feeds.

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Leading category labels seen on the institute/gov pages, longest first.
const CATEGORY_RE = /^(Media Release|AI Adoption|Insights\+\d+|Insights|Updates?|Podcast|Research|News)\s*/i;

const pad = (n) => String(n).padStart(2, "0");

// Parse a date at the very start of the string. Returns { iso, length } where
// length is how many chars to strip (0 if no date found).
function parseLeadingDate(text) {
  let m = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/); // 17 December 2025
  if (m && MONTHS[m[2].toLowerCase()]) {
    return { iso: `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`, length: m[0].length };
  }
  m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})/); // Jun 4, 2026
  if (m && MONTHS[m[1].toLowerCase()]) {
    return { iso: `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(+m[2])}`, length: m[0].length };
  }
  return { iso: undefined, length: 0 };
}

export function cleanTitle(raw) {
  let t = raw.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4 && CATEGORY_RE.test(t); i++) {
    t = t.replace(CATEGORY_RE, "");
  }
  const { iso, length } = parseLeadingDate(t);
  if (length) t = t.slice(length);
  t = t.replace(/^[\s:\-–—|,]+/, "").trim(); // tidy separators left behind
  return { title: t || raw.trim(), date: iso };
}

export function cleanItem(item) {
  const { title, date } = cleanTitle(item.title);
  return { ...item, title, date: item.date ?? date };
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${ABBR[m - 1]} ${d}, ${y}`;
}
