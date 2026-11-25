import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Test the actual browser script embedded in the Deno Edge function; no Supabase calls.
const source = readFileSync(new URL("../supabase/functions/evidence-news-desk/index.ts", import.meta.url), "utf8");
const literal = source.match(/^const html=("(?:\\.|[^"\\])*");/m);
assert.ok(literal, "Expected encoded editor HTML");
const html = JSON.parse(literal[1]);
const embeddedScript = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(embeddedScript, "Expected embedded editor script");
const script = embeddedScript[1];
new vm.Script(script); // Browser JavaScript parses before running.

const helperStart = script.indexOf("function safeArticleUrl(value){");
const helperEnd = script.indexOf("\nlet token=", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "Expected URL guard");
const helper = script.slice(helperStart, helperEnd);
const safeArticleUrl = vm.runInNewContext(helper + "\nsafeArticleUrl", { URL });

test("allows normal document citations with query strings and fragments", () => {
  assert.equal(safeArticleUrl("https://archives.gov/document?id=42#page=3"),
    "https://archives.gov/document?id=42#page=3");
  assert.equal(safeArticleUrl("http://example.org/archive"), "http://example.org/archive");
});

test("rejects executable schemes, embedded credentials, controls and ambiguous URLs", () => {
  for (const raw of [
    "javascript:alert(document.domain)", "data:text/html,x",
    "//archives.gov/document", "/relative", "ftp://example.org/a",
    "https://archives.gov@attacker.example/doc",
    "https://user:password@example.org/doc",
    "https://example.org\\@attacker.example/doc",
    "https://example.org/a\nb", "https://example.org/a b",
    "https://example.org/a\tb", "", null, undefined, 42
  ]) assert.equal(safeArticleUrl(raw), null, String(raw));
});

function renderOne(url) {
  const start = script.indexOf("function render(){");
  const end = script.indexOf('\n$("topic").addEventListener', start);
  assert.ok(start >= 0 && end > start, "Expected editor renderer");
  const elements = Object.fromEntries(
    ["total", "topic-count", "outlets", "pending", "signals", "phrases", "articles"]
      .map(id => [id, { innerHTML: "", textContent: "" }])
  );
  const articles = [{
    id: 1, title: "Research source", canonical_url: url,
    outlet_domain: "example.org", collected_at: "2026-11-23T00:00:00Z",
    frame_signals: {}, review_status: "pending"
  }];
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  new vm.Script(helper + "\n" + script.slice(start, end) + "\nrender();")
    .runInNewContext({ URL, current: () => articles, articles,
      $: id => elements[id], escapeHTML, tokens: () => [] });
  return elements.articles.innerHTML;
}

test("renderer emits no link for unsafe sources while preserving article text", () => {
  const html = renderOne("javascript:alert(1)");
  assert.doesNotMatch(html, /<a\b/i);
  assert.match(html, /Research source/);
  assert.match(html, /unsafe source destination withheld/);
});

test("renderer makes valid source URL clickable", () => {
  const html = renderOne("https://archives.gov/document?id=42#page=3");
  assert.match(html, /<a href="https:\/\/archives\.gov\/document\?id=42#page=3"/);
  assert.doesNotMatch(html, /unsafe source destination withheld/);
});

test("renderer withholds misleading credential-bearing authority", () => {
  const html = renderOne("https://archives.gov@attacker.example/doc");
  assert.doesNotMatch(html, /<a\b/i);
  assert.doesNotMatch(html, /attacker\.example/);
});
