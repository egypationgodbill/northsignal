import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, groupByTheme, hasMoney } from "../src/theme.js";

const item = (title, url = "https://x/") => ({ title, url });

test("sector themes win over the generic funding bucket", () => {
  // Mentions money, but it's a health item -> Health, not Funding.
  assert.equal(classify(item("Amii launches $10M Health Innovation Lab")).key, "health");
  assert.equal(classify(item("$24M for 42 CIFAR AI Chairs")).key, "talent");
});

test("pure money news falls into funding", () => {
  assert.equal(classify(item("SCALE AI announces $129M financing round")).key, "funding");
});

test("partnership and policy keywords route correctly", () => {
  assert.equal(classify(item("Mila and Cohere announce partnership")).key, "partnerships");
  assert.equal(classify(item("Canada's National AI Strategy: AI for All")).key, "policy");
});

test("unmatched items land in other", () => {
  assert.equal(classify(item("Live from Upper Bound 2026")).key, "other");
});

test("hasMoney detects dollar figures", () => {
  assert.ok(hasMoney(item("$73 M for Quebec projects")));
  assert.ok(hasMoney(item("nearly $100M invested")));
  assert.equal(hasMoney(item("Amii welcomes two new board directors")), false);
});

test("groupByTheme returns non-empty groups in theme order", () => {
  const groups = groupByTheme([
    item("SCALE AI $129M financing round"),
    item("New Health AI clinical tool"),
    item("Random update"),
  ]);
  assert.deepEqual(groups.map((g) => g.theme.key), ["health", "funding", "other"]);
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), 3);
});
