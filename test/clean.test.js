import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, formatDate } from "../src/clean.js";

test("strips a leading 'DD Month YYYY' date and parses it", () => {
  const r = cleanTitle("17 December 2025SCALE AI Announces New Investments Across Manitoba");
  assert.equal(r.title, "SCALE AI Announces New Investments Across Manitoba");
  assert.equal(r.date, "2025-12-17");
});

test("strips a leading 'Mon DD, YYYY' date", () => {
  const r = cleanTitle("Jun 4, 2026AI for All: Canada's National AI Strategy");
  assert.equal(r.title, "AI for All: Canada's National AI Strategy");
  assert.equal(r.date, "2026-06-04");
});

test("collapses doubled category labels then strips the date", () => {
  const r = cleanTitle("Media ReleaseMedia ReleaseMay 20, 2026Amii Launches $10M Health Innovation Lab");
  assert.equal(r.title, "Amii Launches $10M Health Innovation Lab");
  assert.equal(r.date, "2026-05-20");
});

test("unwinds a stacked category prefix (Insights+1InsightsPodcast)", () => {
  const r = cleanTitle("Insights+1InsightsPodcastMar 17, 2026Keep AI Weird: Kate Compton");
  assert.equal(r.title, "Keep AI Weird: Kate Compton");
  assert.equal(r.date, "2026-03-17");
});

test("strips a bare category label with no date", () => {
  const r = cleanTitle("Research Hassan Ashtiani: Building trustworthy AI");
  assert.equal(r.title, "Hassan Ashtiani: Building trustworthy AI");
  assert.equal(r.date, undefined);
});

test("leaves a clean title untouched", () => {
  const r = cleanTitle("Toboggan Labs Joins Mila's Industry Partner Network");
  assert.equal(r.title, "Toboggan Labs Joins Mila's Industry Partner Network");
  assert.equal(r.date, undefined);
});

test("formatDate renders a human date", () => {
  assert.equal(formatDate("2025-12-17"), "Dec 17, 2025");
  assert.equal(formatDate(undefined), "");
});
