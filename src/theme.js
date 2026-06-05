// Topic themes for an issue. First match wins, so order = editorial priority:
// sector-specific themes come before the generic "Funding" bucket, and "Other"
// is the catch-all. Tune the keyword regexes per how the newsletter should read.
// `color` is the aurora/signal accent used in the instrument-panel UI
// (distribution bar, legend, theme headers).
export const THEMES = [
  { key: "health", label: "Health & Life Sciences", icon: "🏥", color: "#33e6b0",
    match: /health|healthcare|clinical|medical|\bdrug\b|patient|life scien|biotech|genomic/i },
  { key: "talent", label: "Talent, Skills & Literacy", icon: "🎓", color: "#4aa6ff",
    match: /talent|literacy|\btraining\b|workforce|scholarship|student|educat|\bchair(s)?\b|\bskills\b|k-?12|recruit|fellow/i },
  { key: "compute", label: "Compute & Infrastructure", icon: "⚙️", color: "#3ad6d0",
    match: /compute|supercomputer|data ?cent(re|er)|\bgpu\b|sovereign|infrastructure|electricity|megawatt|gigawatt/i },
  { key: "partnerships", label: "Partnerships & Global", icon: "🤝", color: "#b070ff",
    match: /partner|alliance|collaborat|delegation|vivatech|summit|consortium|\bjoins?\b|memorandum/i },
  { key: "policy", label: "Policy, Safety & Strategy", icon: "🛡️", color: "#e9a23b",
    match: /strateg|policy|\bsafety\b|trust|governance|regulat|democra|privacy|\bsecur|standard|certif/i },
  { key: "funding", label: "Funding & Investment", icon: "💰", color: "#ff4632",
    match: /\$|\bmillion\b|\bbillion\b|invest|financing|funding|\bgrant(s)?\b|capital|venture|round/i },
  { key: "other", label: "Other Updates", icon: "📰", color: "#8e979c", match: /.*/ },
];

const OTHER = THEMES[THEMES.length - 1];

// Pick the single best theme for an item (title + url as the haystack).
export function classify(item) {
  const hay = `${item.title} ${item.url}`;
  return THEMES.find((t) => t.match.test(hay)) ?? OTHER;
}

// Detect a dollar figure so the summary can surface money items as highlights.
const MONEY_RE = /\$\s?\d[\d.,]*\s?(?:billion|million|[mbk])?\b/i;
export function hasMoney(item) {
  return MONEY_RE.test(item.title);
}

// Pull the dollar figure out of a title as a compact label: "$73 M" -> "$73M",
// "$21 million" -> "$21M", "$1.7 billion" -> "$1.7B". Returns null if none.
const AMOUNT_RE = /\$\s?(\d[\d.,]*)\s?(billion|million|bn|[mbk])?\b/i;
export function extractAmount(title) {
  const m = title.match(AMOUNT_RE);
  if (!m) return null;
  const num = m[1].replace(/[.,]+$/, "");
  const unit = (m[2] ?? "").toLowerCase();
  const u = /^b/.test(unit) ? "B" : /^m/.test(unit) ? "M" : /^k/.test(unit) ? "K" : "";
  return `$${num}${u}`;
}

// Group items into themes; returns themes in THEMES order, empties dropped.
export function groupByTheme(items) {
  const buckets = new Map(THEMES.map((t) => [t.key, []]));
  for (const item of items) buckets.get(classify(item).key).push(item);
  return THEMES
    .map((theme) => ({ theme, items: buckets.get(theme.key) }))
    .filter((g) => g.items.length > 0);
}
