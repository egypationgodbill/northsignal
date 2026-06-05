import { groupByTheme, hasMoney, extractAmount } from "./theme.js";
import { cleanItem, formatDate } from "./clean.js";

const THEME_PREVIEW = 8; // items shown per theme before "show more"

// Render the latest issue as the "instrument panel" front page — a single
// self-contained static HTML file. Content is server-rendered (visible with no
// JS); inline script only adds live chrome: clock, count-up, filters, reveal.
export function renderSiteHtml(issues) {
  const [latest] = issues;
  if (!latest) return shell("", `<main class="wrap"><p class="empty">No issues yet. Run <code>npm run scrape</code>.</p></main>`);
  return shell(latest.date, renderIssue(buildModel(latest)));
}

// --- data model ----------------------------------------------------------
function buildModel(issue) {
  const items = collectItems(issue);
  const themes = groupByTheme(items).map((g) => ({
    key: g.theme.key, icon: g.theme.icon, label: g.theme.label, color: g.theme.color,
    items: byDateDesc(g.items),
  }));
  const money = items.filter(hasMoney);
  const total = items.length;

  return {
    date: issue.date,
    counts: { new: issue.counts.new, updated: issue.counts.changed },
    themes,
    total,
    moneyCount: money.length,
    highlights: pickHighlights(money).map((h) => ({
      title: h.title, url: h.url, date: fmt(h), source: h.sourceName, amount: extractAmount(h.title),
    })),
    sources: issue.perSource.map((s) => {
      const n = (s.added?.length ?? 0) + (s.changed?.length ?? 0);
      return { name: s.name, note: s.error ?? (n ? `${n} new/updated` : "no change"), count: n };
    }),
  };
}

function collectItems(issue) {
  const items = [];
  for (const s of issue.perSource) {
    if (s.error) continue;
    for (const i of s.added) items.push({ ...cleanItem(i), sourceName: s.name, status: "new" });
    for (const i of s.changed) items.push({ ...cleanItem(i), sourceName: s.name, status: "updated" });
  }
  return items;
}

// Recent + source-diverse money items: newest first, max 2 per source, top 6.
function pickHighlights(money) {
  const sorted = [...money].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const perSource = new Map();
  const out = [];
  for (const it of sorted) {
    const seen = perSource.get(it.source) ?? 0;
    if (seen >= 2) continue;
    perSource.set(it.source, seen + 1);
    out.push(it);
    if (out.length >= 6) break;
  }
  return out;
}

const byDateDesc = (items) => [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
const fmt = (item) => (item.date ? formatDate(item.date) : null);

// --- page sections (server-rendered) ------------------------------------
function renderIssue(m) {
  return `${statusbar(m)}
<a id="top"></a>
${hero(m)}
<main>
${distribution(m)}
${money(m)}
${stream(m)}
${sources(m)}
</main>
${footer(m)}`;
}

function statusbar(m) {
  return `<div class="statusbar"><div class="wrap">
    <a class="logo" href="#top" aria-label="NorthSignal">
      <svg class="mark" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 1 L20.5 19 H1.5 Z" stroke="#ff4632" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M11 7 L16 17 H6 Z" fill="#ff4632"/>
      </svg>
      <span><b>North</b><span class="sig">Signal</span></span>
    </a>
    <div class="sb-meta hide-sm">
      <span class="sb-item"><span class="k">ISSUE</span><span class="v">${esc(m.date)}</span></span>
      <span class="sb-item"><span class="k">CADENCE</span><span class="v">BIMONTHLY</span></span>
      <span class="sb-item"><span class="dot live"></span><span class="v">LIVE</span><span class="k" id="sb-clock">--:--:-- UTC</span></span>
    </div>
    <div class="sb-right">
      <a class="sb-link hide-sm" href="#themes">Themes</a>
      <a class="sb-link hide-sm" href="#sources">Sources</a>
      <a class="sb-link" href="${REPO}" target="_blank" rel="noopener">GitHub</a>
      <a class="mcp-pill" href="#mcp" title="Model Context Protocol endpoint — coming soon">MCP <span class="soon">soon</span></a>
    </div>
  </div></div>
  <div class="aurora"></div>`;
}

function hero(m) {
  const metrics = [
    { n: m.counts.new, l: "New items", hot: true, spark: "▲" },
    { n: m.counts.updated, l: "Updated" },
    { n: m.themes.length, l: "Themes" },
    { n: m.sources.length, l: "Sources" },
    { n: m.moneyCount, l: "Money flags", hot: true, spark: "$" },
  ];
  const cells = metrics.map((x) => `<div class="metric${x.hot ? " hot" : ""}">
      ${x.spark ? `<span class="spark">${x.spark}</span>` : ""}
      <div class="num"><span class="cval" data-target="${x.n}">${x.n}</span></div>
      <div class="lbl">${esc(x.l)}</div>
    </div>`).join("");

  return `<header class="hero"><div class="wrap">
    <div class="hero-top">
      <span class="kicker">What changed this issue</span>
      <span class="issue-tag">ISSUE · ${esc(m.date)}</span>
    </div>
    <h1 class="headline">Canada's AI funding, <em>tracked by the diff.</em></h1>
    <p class="lede">${lede(m)}</p>
    <div class="readout">${cells}</div>
  </div></header>`;
}

function lede(m) {
  const sources = `<b>${m.sources.length} official sources</b>`;
  if (m.counts.updated === 0) {
    return `First snapshot of the cycle — <b>${m.counts.new} fresh items</b> across ${sources}, ${m.moneyCount} of them carrying a dollar figure. Nothing updated yet: this issue sets the baseline every future diff is measured against.`;
  }
  return `<b>${m.counts.new} new</b> and <b>${m.counts.updated} updated</b> items across ${sources} this issue — ${m.moneyCount} carrying a dollar figure.`;
}

function distribution(m) {
  const segs = m.themes.map((t) => {
    const pct = Math.round((t.items.length / m.total) * 100);
    return `<div class="dist-seg" data-key="${t.key}" data-grow="${t.items.length}"
        style="background:${t.color};flex-grow:${t.items.length}"
        title="${esc(t.label)} — ${t.items.length} (${pct}%)">${pct >= 9 ? `<span class="seg-pct">${pct}%</span>` : ""}</div>`;
  }).join("");
  const legend = m.themes.map((t) =>
    `<div class="leg" data-key="${t.key}"><span class="sw" style="background:${t.color}"></span>${esc(t.label)} <span class="lc">${t.items.length}</span></div>`
  ).join("");

  return `<section class="block wrap" id="dist-block">
    ${blockHead("Theme distribution", `${m.total} items`)}
    <div class="dist"><div class="dist-bar">${segs}</div><div class="dist-legend">${legend}</div></div>
  </section>`;
}

function money(m) {
  const cards = m.highlights.map((h) => `<a class="mcard" href="${esc(h.url)}" target="_blank" rel="noopener">
      ${h.amount ? `<div class="amt">${esc(h.amount)}</div>` : ""}
      <div class="mt">${esc(h.title)}</div>
      <div class="mm">${h.date ? `<span>${esc(h.date)}</span><span class="sep">·</span>` : ""}<span>${esc(h.source)}</span></div>
    </a>`).join("");
  return `<section class="block wrap" id="money-block">
    ${blockHead("Money on the move", `${m.moneyCount} items flag a $ figure`)}
    <div class="cards">${cards}</div>
  </section>`;
}

function stream(m) {
  const filters = `<div class="fchip active" data-key="all">All <span class="fc">${m.total}</span></div>` +
    m.themes.map((t) => `<div class="fchip" data-key="${t.key}"><span class="ic">${t.icon}</span>${esc(t.label)} <span class="fc">${t.items.length}</span></div>`).join("");

  const groups = m.themes.map((t) => {
    const head = t.items.slice(0, THEME_PREVIEW);
    const rest = t.items.slice(THEME_PREVIEW);
    const more = rest.length
      ? `<details class="more"><summary><span class="chev">▸</span> Show ${rest.length} more</summary><ul class="items">${rest.map(row).join("")}</ul></details>`
      : "";
    return `<div class="theme-grp" data-key="${t.key}">
      <h3><span class="accent" style="background:${t.color}"></span><span class="ic">${t.icon}</span>${esc(t.label)}<span class="tc">${t.items.length}</span></h3>
      <ul class="items">${head.map(row).join("")}</ul>
      ${more}
    </div>`;
  }).join("");

  return `<section class="block wrap" id="themes">
    ${blockHead("By theme", `${m.total} items · ${m.themes.length} themes`)}
    <div class="filters">${filters}</div>
    <div id="stream">${groups}</div>
  </section>`;
}

function row(it) {
  const d = it.date ? formatDate(it.date) : null;
  return `<li>
    <div class="row-date${d ? "" : " none"}">${d ? esc(d) : "— — —"}</div>
    <div class="row-main">
      <a class="row-title" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>
      <div class="row-meta"><span class="badge ${it.status === "updated" ? "upd" : "new"}">${it.status}</span><span class="src-name">${esc(it.sourceName)}</span></div>
    </div>
  </li>`;
}

function sources(m) {
  const cells = m.sources.map((s) => {
    const cls = s.count === 0 ? "idle" : s.count >= 20 ? "hot" : "active";
    return `<div class="src-cell"><span class="sdot ${cls}"></span><span class="sname">${esc(s.name)}</span><span class="snote ${s.count ? "has" : "no"}">${esc(s.note)}</span></div>`;
  }).join("");
  return `<section class="block wrap" id="sources">
    ${blockHead("Source health", `${m.sources.length} polled`)}
    <div class="src-grid">${cells}</div>
  </section>`;
}

function footer(m) {
  return `<footer class="foot"><div class="wrap">
    <div class="foot-grid">
      <div class="foot-col"><h4>NorthSignal</h4>
        <p>A bimonthly tracker for Canada's AI policy, funding programs &amp; RFPs. It scrapes official sources, diffs each run against the last snapshot, and surfaces only <b style="color:var(--ink-2)">what changed</b>.</p></div>
      <div class="foot-col" id="mcp"><h4>For agents</h4>
        <p>An <span style="color:var(--aurora-1)">MCP</span> endpoint is coming — so coding agents and research assistants can query each issue's diff directly. No signup, no scraping.</p></div>
      <div class="foot-col"><h4>Links</h4>
        <a class="fl" href="${REPO}" target="_blank" rel="noopener">→ GitHub repo</a>
        <a class="fl" href="#sources">→ Tracked sources</a>
        <a class="fl" href="#top">→ Latest issue</a></div>
    </div>
    <div class="foot-bottom">
      <span>Generated by NorthSignal</span><span class="sep">/</span>
      <span>Sources are official Canadian gov &amp; institute pages</span><span class="sep">/</span>
      <span>Issue ${esc(m.date)}</span>
    </div>
  </div></footer>`;
}

const blockHead = (title, count) =>
  `<div class="block-head"><h2>${esc(title)}</h2><span class="rule"></span><span class="count">${esc(count)}</span></div>`;

const REPO = "https://github.com/egypationgodbill/northsignal";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- HTML shell (styles + inline behavior) ------------------------------
function shell(date, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NorthSignal — Canadian AI policy &amp; funding tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
${body}
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const STYLE = `
:root {
  --bg:#0a0c0e; --bg-2:#0e1114; --panel:#12161a; --panel-2:#161b20;
  --line:#1f262c; --line-2:#2a333a; --ink:#e8ebe6; --ink-2:#c2c8c4;
  --muted:#7e878c; --faint:#525c61;
  --signal:#ff4632; --signal-dim:#c23425; --signal-glow:rgba(255,70,50,.22); --amber:#e9a23b;
  --aurora-1:#33e6b0; --aurora-2:#4aa6ff; --aurora-3:#b070ff;
  --mono:"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --sans:"IBM Plex Sans", ui-sans-serif, -apple-system, sans-serif;
  --maxw:1060px;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body {
  margin:0; background:var(--bg); color:var(--ink); font:400 16px/1.6 var(--sans);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  background-image:
    radial-gradient(1200px 480px at 78% -8%, rgba(74,166,255,.05), transparent 60%),
    radial-gradient(900px 420px at 12% -6%, rgba(176,112,255,.045), transparent 60%);
  background-attachment:fixed;
}
a { color:inherit; text-decoration:none; }
.wrap { max-width:var(--maxw); margin:0 auto; padding:0 28px; }
.empty { color:var(--muted); padding:60px 0; font-family:var(--mono); }
.mono { font-family:var(--mono); }
.label { font:600 11px/1 var(--mono); text-transform:uppercase; letter-spacing:.18em; color:var(--muted); }

.statusbar { position:sticky; top:0; z-index:50; background:rgba(10,12,14,.82); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); }
.statusbar .wrap { display:flex; align-items:center; gap:22px; height:52px; }
.logo { display:flex; align-items:center; gap:10px; font:700 15px/1 var(--mono); letter-spacing:-.01em; }
.logo .mark { width:22px; height:22px; flex:0 0 22px; }
.logo .sig { color:var(--signal); }
.sb-meta { display:flex; align-items:center; gap:18px; margin-left:6px; }
.sb-item { display:flex; align-items:center; gap:7px; font:500 11.5px/1 var(--mono); color:var(--muted); white-space:nowrap; }
.sb-item .k { color:var(--faint); letter-spacing:.06em; }
.sb-item .v { color:var(--ink-2); }
.dot { width:7px; height:7px; border-radius:50%; background:var(--aurora-1); }
.dot.live { animation:pulse 2.4s ease-out infinite; }
@keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(51,230,176,.45);} 70%{box-shadow:0 0 0 6px rgba(51,230,176,0);} 100%{box-shadow:0 0 0 0 rgba(51,230,176,0);} }
.sb-right { margin-left:auto; display:flex; align-items:center; gap:4px; }
.sb-link { font:500 12px/1 var(--mono); color:var(--muted); padding:8px 11px; border-radius:7px; transition:.15s; }
.sb-link:hover { color:var(--ink); background:var(--panel-2); }
.mcp-pill { display:inline-flex; align-items:center; gap:7px; font:600 11px/1 var(--mono); letter-spacing:.04em; color:var(--aurora-1); padding:7px 11px; border:1px solid rgba(51,230,176,.32); border-radius:7px; background:rgba(51,230,176,.05); transition:.15s; }
.mcp-pill:hover { border-color:rgba(51,230,176,.6); background:rgba(51,230,176,.1); }
.mcp-pill .soon { color:var(--faint); font-weight:500; }
.hide-sm { display:flex; }

.aurora { height:2px; width:100%; background:linear-gradient(90deg, transparent, var(--aurora-1) 18%, var(--aurora-2) 50%, var(--aurora-3) 78%, transparent); opacity:.7; filter:blur(.3px); }

.hero { position:relative; padding:62px 0 30px; overflow:hidden; }
.hero::before { content:""; position:absolute; inset:-40% 0 auto 0; height:340px; z-index:0;
  background:
    radial-gradient(620px 220px at 30% 0%, rgba(51,230,176,.10), transparent 70%),
    radial-gradient(560px 200px at 62% 4%, rgba(74,166,255,.10), transparent 70%),
    radial-gradient(520px 200px at 85% 0%, rgba(176,112,255,.09), transparent 70%);
  pointer-events:none; filter:blur(8px); animation:drift 16s ease-in-out infinite alternate; }
@keyframes drift { from{transform:translateX(-14px);} to{transform:translateX(18px);} }
.hero .wrap { position:relative; z-index:1; }
.hero-top { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
.kicker { font:600 12px/1 var(--mono); letter-spacing:.22em; text-transform:uppercase; color:var(--signal); }
.issue-tag { font:500 12px/1 var(--mono); letter-spacing:.06em; color:var(--muted); }
.headline { font:600 clamp(34px,5vw,56px)/1.04 var(--mono); letter-spacing:-.02em; color:var(--ink); margin:18px 0 0; max-width:18ch; }
.headline em { font-style:normal; color:var(--signal); }
.lede { margin:18px 0 0; max-width:62ch; color:var(--ink-2); font:400 17px/1.6 var(--sans); }
.lede b { color:var(--ink); font-weight:600; }

.readout { display:grid; grid-template-columns:repeat(5,1fr); gap:1px; margin-top:38px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.metric { background:var(--panel); padding:22px 20px 18px; position:relative; }
.metric:hover { background:var(--panel-2); }
.metric .num { font:600 clamp(30px,3.6vw,44px)/1 var(--mono); letter-spacing:-.02em; color:var(--ink); display:flex; align-items:baseline; gap:4px; }
.metric.hot .num { color:var(--signal); }
.metric .lbl { margin-top:9px; font:600 10.5px/1.3 var(--mono); text-transform:uppercase; letter-spacing:.13em; color:var(--muted); }
.metric .spark { position:absolute; top:18px; right:18px; font:600 10px/1 var(--mono); color:var(--faint); }
.metric.hot .spark { color:var(--signal); }

section.block { padding:46px 0 0; }
.block-head { display:flex; align-items:center; gap:14px; margin-bottom:20px; }
.block-head h2 { font:600 13px/1 var(--mono); text-transform:uppercase; letter-spacing:.16em; color:var(--ink-2); margin:0; }
.block-head .rule { flex:1; height:1px; background:var(--line); }
.block-head .count { font:500 12px/1 var(--mono); color:var(--faint); }

.dist { border:1px solid var(--line); border-radius:12px; background:var(--panel); padding:20px; }
.dist-bar { display:flex; height:38px; border-radius:7px; overflow:hidden; background:var(--bg-2); }
.dist-seg { position:relative; transition:flex-grow .5s cubic-bezier(.2,.7,.2,1), filter .15s; min-width:3px; cursor:pointer; }
.dist-seg:hover { filter:brightness(1.25); }
.dist-seg .seg-pct { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font:600 11px/1 var(--mono); color:rgba(10,12,14,.7); }
.dist-legend { display:grid; grid-template-columns:repeat(auto-fill,minmax(228px,1fr)); gap:12px 22px; margin-top:20px; }
.leg { display:flex; align-items:baseline; gap:9px; font:500 12.5px/1.35 var(--mono); color:var(--ink-2); cursor:pointer; transition:.15s; }
.leg:hover { color:var(--ink); }
.leg .sw { width:10px; height:10px; border-radius:3px; flex:0 0 10px; transform:translateY(1px); }
.leg .lc { color:var(--faint); margin-left:auto; padding-left:10px; }

.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(232px,1fr)); gap:12px; }
.mcard { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; transition:.18s; position:relative; overflow:hidden; }
.mcard::after { content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--signal-dim); opacity:.5; }
.mcard:hover { border-color:var(--line-2); transform:translateY(-2px); }
.mcard:hover::after { opacity:1; background:var(--signal); }
.mcard .amt { font:600 30px/1 var(--mono); letter-spacing:-.02em; color:var(--signal); }
.mcard .mt { font:500 13.5px/1.45 var(--sans); color:var(--ink); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.mcard .mm { display:flex; gap:8px; align-items:center; font:500 11px/1 var(--mono); color:var(--muted); margin-top:auto; }
.mcard .mm .sep { color:var(--faint); }

.filters { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
.fchip { display:inline-flex; align-items:center; gap:8px; font:500 12.5px/1 var(--mono); color:var(--ink-2); background:var(--panel); border:1px solid var(--line); border-radius:999px; padding:9px 14px; cursor:pointer; transition:.15s; user-select:none; }
.fchip:hover { border-color:var(--line-2); color:var(--ink); }
.fchip.active { background:var(--ink); color:var(--bg); border-color:var(--ink); }
.fchip .fc { font-weight:600; color:var(--faint); }
.fchip.active .fc { color:var(--signal-dim); }
.fchip .ic { font-size:14px; line-height:1; }

.theme-grp { margin-top:30px; }
.theme-grp.dim { display:none; }
.theme-grp > h3 { display:flex; align-items:center; gap:11px; margin:0 0 4px; font:600 15px/1.2 var(--mono); color:var(--ink); letter-spacing:-.01em; }
.theme-grp > h3 .ic { font-size:16px; }
.theme-grp > h3 .tc { margin-left:auto; font:600 11px/1 var(--mono); color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:4px 9px; }
.theme-grp > h3 .accent { width:8px; height:8px; border-radius:2px; }

ul.items { list-style:none; margin:0; padding:0; }
ul.items > li { display:grid; grid-template-columns:74px 1fr; gap:16px; align-items:baseline; padding:13px 0; border-bottom:1px solid var(--line); }
ul.items > li:hover { border-color:var(--line-2); }
.row-date { font:500 11.5px/1.5 var(--mono); color:var(--muted); white-space:nowrap; padding-top:1px; }
.row-date.none { color:var(--faint); }
.row-main { min-width:0; }
.row-title { font:500 15.5px/1.45 var(--sans); color:var(--ink); transition:.12s; }
li:hover .row-title { color:#fff; }
.row-title:hover { color:var(--signal); }
.row-meta { display:flex; align-items:center; gap:9px; margin-top:6px; font:500 11.5px/1 var(--mono); color:var(--muted); flex-wrap:wrap; }
.row-meta .src-name { color:var(--faint); }
.badge { display:inline-flex; align-items:center; font:700 9px/1 var(--mono); text-transform:uppercase; letter-spacing:.1em; padding:3px 6px; border-radius:4px; vertical-align:1px; }
.badge.new { color:var(--signal); border:1px solid var(--signal-dim); background:var(--signal-glow); }
.badge.upd { color:var(--amber); border:1px solid rgba(233,162,59,.4); background:rgba(233,162,59,.1); }

.more { margin-top:6px; }
.more summary { cursor:pointer; list-style:none; font:600 12px/1 var(--mono); color:var(--muted); padding:11px 0; display:inline-flex; align-items:center; gap:8px; transition:.15s; }
.more summary:hover { color:var(--ink); }
.more summary::-webkit-details-marker { display:none; }
.more summary .chev { color:var(--signal); transition:transform .2s; display:inline-block; }
.more[open] summary .chev { transform:rotate(90deg); }

.src-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.src-cell { background:var(--panel); padding:16px 18px; display:flex; align-items:center; gap:13px; transition:.15s; }
.src-cell:hover { background:var(--panel-2); }
.src-cell .sdot { width:9px; height:9px; border-radius:50%; flex:0 0 9px; }
.src-cell .sdot.active { background:var(--aurora-1); box-shadow:0 0 9px rgba(51,230,176,.5); }
.src-cell .sdot.idle { background:var(--faint); }
.src-cell .sdot.hot { background:var(--signal); box-shadow:0 0 9px var(--signal-glow); }
.src-cell .sname { font:500 13px/1.3 var(--sans); color:var(--ink-2); }
.src-cell .snote { margin-left:auto; font:600 11px/1 var(--mono); white-space:nowrap; }
.src-cell .snote.has { color:var(--signal); }
.src-cell .snote.no { color:var(--faint); }

footer.foot { margin-top:64px; border-top:1px solid var(--line); padding:34px 0 60px; }
.foot-grid { display:flex; justify-content:space-between; gap:40px; flex-wrap:wrap; align-items:flex-start; }
.foot-col { flex:1 1 220px; min-width:200px; }
.foot-col h4 { font:600 11px/1 var(--mono); text-transform:uppercase; letter-spacing:.16em; color:var(--muted); margin:0 0 12px; }
.foot-col p { margin:0; max-width:46ch; color:var(--faint); font:400 13.5px/1.6 var(--sans); }
.foot-col a.fl { display:block; white-space:nowrap; font:500 13px/1.9 var(--mono); color:var(--ink-2); transition:.12s; }
.foot-col a.fl:hover { color:var(--signal); }
.foot-bottom { margin-top:30px; display:flex; gap:14px; align-items:center; font:500 11.5px/1.6 var(--mono); color:var(--faint); flex-wrap:wrap; }
.foot-bottom .sep { opacity:.5; }

@media (max-width:860px){ .readout { grid-template-columns:repeat(2,1fr); } .metric:nth-child(5){ grid-column:1 / -1; } .sb-meta { display:none; } }
@media (max-width:560px){ .wrap { padding:0 18px; } .hide-sm { display:none; } ul.items > li { grid-template-columns:1fr; gap:6px; } .row-date { padding-top:0; } }
@media (prefers-reduced-motion:reduce){ *, *::before { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
`;

// Inline behavior. No template literals / no "$" + "{" sequences inside — this
// whole string is embedded in a template literal by shell().
const SCRIPT = `(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // live UTC clock
  var clock = document.getElementById('sb-clock');
  function pad(n){ return String(n).padStart(2,'0'); }
  function tick(){ if(!clock) return; var d=new Date();
    clock.textContent = pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+' UTC'; }
  tick(); setInterval(tick,1000);

  // count-up metrics (re-animate from 0 to the server-rendered value)
  function countUp(node,target){
    target = Number(target)||0;
    if(reduce || target===0){ node.textContent = target; return; }
    var dur=1100, steps=34, i=0;
    node.textContent='0';
    var id=setInterval(function(){ i++; var k=i/steps; var e=1-Math.pow(1-k,3);
      node.textContent=Math.round(target*e);
      if(i>=steps){ node.textContent=target; clearInterval(id); } }, dur/steps);
    setTimeout(function(){ node.textContent=target; clearInterval(id); }, dur+250);
  }
  [].forEach.call(document.querySelectorAll('.cval'), function(n){ countUp(n, n.getAttribute('data-target')); });

  // distribution bar grow-in
  if(!reduce){
    var segs=document.querySelectorAll('.dist-seg');
    [].forEach.call(segs, function(s){ s.style.flexGrow='0'; });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      [].forEach.call(segs, function(s){ s.style.flexGrow=s.getAttribute('data-grow'); }); }); });
    setTimeout(function(){ [].forEach.call(segs, function(s){ s.style.flexGrow=s.getAttribute('data-grow'); }); }, 900);
  }

  // theme filtering (chips + distribution segments + legend)
  var filters=document.querySelector('.filters');
  function filterTo(key){
    if(filters){ [].forEach.call(filters.children, function(c){
      c.classList.toggle('active', c.getAttribute('data-key')===key); }); }
    [].forEach.call(document.querySelectorAll('.theme-grp'), function(g){
      g.classList.toggle('dim', !(key==='all' || g.getAttribute('data-key')===key)); });
    if(key!=='all'){
      var el=document.querySelector('.theme-grp[data-key="'+key+'"]');
      if(el){ var y=el.getBoundingClientRect().top+window.scrollY-80;
        window.scrollTo({ top:y, behavior: reduce?'auto':'smooth' }); }
    }
  }
  function wire(sel){ [].forEach.call(document.querySelectorAll(sel), function(node){
    node.addEventListener('click', function(){ filterTo(node.getAttribute('data-key')); }); }); }
  wire('.fchip'); wire('.dist-seg'); wire('.leg');

  // diff reveal — additive only: content is visible by default, never hidden permanently
  if(!reduce && 'IntersectionObserver' in window){
    var rows=[].slice.call(document.querySelectorAll('ul.items > li, .mcard'));
    function reveal(r){ if(!r.dataset.pending) return; delete r.dataset.pending;
      r.style.transition='opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1)';
      r.style.opacity='1'; r.style.transform='none'; }
    function snap(r){ delete r.dataset.pending; r.style.transition='none';
      r.style.opacity='1'; r.style.transform='none'; }
    function snapAll(){ rows.forEach(snap); }
    rows.forEach(function(r){ if(r.getBoundingClientRect().top > window.innerHeight*0.9){
      r.dataset.pending='1'; r.style.opacity='0'; r.style.transform='translateY(10px)'; } });
    var io=new IntersectionObserver(function(entries){ var d=0;
      entries.forEach(function(en){ if(en.isIntersecting){ var r=en.target;
        setTimeout(function(){ reveal(r); }, d*26); d++; io.unobserve(r); } }); },
      { rootMargin:'0px 0px -6% 0px' });
    rows.forEach(function(r){ if(r.dataset.pending) io.observe(r); });
    setTimeout(snapAll,1600);
    window.addEventListener('load', function(){ setTimeout(snapAll,700); });
  }
})();`;
