# NorthSignal

A bimonthly tracker for **Canada's AI policy, funding programs, and RFPs**. It
scrapes official sources, diffs each run against the last snapshot, and emits a
newsletter-style digest of *what changed* — plus a static HTML archive.

The point isn't to list pages (that's a feed reader). It's to answer the only
question a founder/consultant cares about: **what's new since the last issue?**

## How it works

```
sources.json ──> fetch ──> extract ──> diff(prev, now) ──> digest.md
                                            │                  └─> issues.json ─> site/index.html
                                            └─> snapshots/<source>.json  (new baseline)
```

- `src/fetch.js` — fetch HTML with a timeout + polite UA.
- `src/extract.js` — harvest links from the page's main region; filter per source
  with `include`/`exclude` regexes. Generic on purpose — robust to layout drift.
- `src/diff.js` — `(previous, current) → { added, changed, removed }`, keyed by a
  stable hash of `source + url`.
- `src/digest.js` — render one issue as Markdown (the newsletter body).
- `src/site.js` — render the issue archive as a self-contained HTML page.
- `src/index.js` — orchestrates; **fails soft** per source (a dead URL is recorded
  into the digest, never silently dropped).

## Run it

```bash
cd NorthSignal
npm install      # one dependency: cheerio
npm test         # offline, against fixtures
npm run scrape   # live: hits the real sources, writes data/ + site/
open site/index.html
```

## Outputs (git-tracked, so diffs are reviewable)

- `data/snapshots/<source>.json` — latest items per source (the diff baseline).
- `data/digests/<date>.md` — the newsletter issue for that run.
- `data/issues.json` — rolling archive (latest 50 issues).
- `site/index.html` — static viewer of all issues.

## Adding / tuning a source

Edit `sources.json`:

```json
{
  "key": "ised-news",
  "name": "ISED — Newsroom",
  "url": "https://ised-isde.canada.ca/site/ised/en/news",
  "include": ["ai|fund|program|invest"],   // keep only matching titles/urls
  "exclude": ["careers|subscribe"],          // drop noise
  "linkSelector": "main a",                  // optional; defaults to WET main regions
  "minTitle": 15                              // optional; ignore tiny link text
}
```

## Automation

`.github/workflows/scrape.yml` runs on the 1st of every other month (and on
manual dispatch), runs the tests, scrapes, and commits the new issue back to the
repo.

## Roadmap (v0 → v1)

- [ ] Prefer official APIs over HTML where they exist: **CanadaBuys** (RFPs) and
      **open.canada.ca / data.gc.ca** — far less brittle than scraping.
- [ ] LLM pass to summarize each item and tag by sector / funding stage / deadline.
- [ ] "Closing soon" view — scrape weekly internally, publish bimonthly.
- [ ] Wire the digest to an email provider (Buttondown / Resend) + landing page.
- [ ] Bilingual (EN/FR) mirroring.

> Be a good citizen: check each source's `robots.txt` / terms before adding it,
> and keep the request cadence low.
