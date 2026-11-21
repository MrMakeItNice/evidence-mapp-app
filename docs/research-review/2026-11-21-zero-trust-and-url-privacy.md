# Evidence Atlas editorial and engineering review — 2026-11-21 ~10:16 PST

> **Staging only.** This is a human-review candidate and an observed read-only audit, not an approved or published investigation. No Supabase data/schema changes, live collector modification, deployment, or merge were performed.

## Candidate: GAO federal zero-trust implementation planning

- Primary source: U.S. Government Accountability Office, **GAO-27-108661**, *Cybersecurity: Agencies Need to Fully Address Federal Guidance as They Refine Zero Trust Architecture*, **published and released November 18, 2026**: https://www.gao.gov/products/gao-27-108661
- GAO examined implementation planning at **22** civilian CFO Act agencies against selected OMB/NIST guidance. It reported that **5 agencies** addressed the selected guidance and **17 did not fully do so** as of August 2026.
- GAO made **40 recommendations** to **17 agencies**. It says **13 agencies agreed**, while **4 neither agreed nor disagreed**. Agencies cited limited staffing and funding among reasons; implementation is ongoing.
- **Editorial caveat:** a planning-gap finding is not evidence of a breach, a successful attack, deliberate misconduct, or that the agency has no security controls. Review methodology, scope, agency responses, and recommendation status before writing a story. Avoid portraying plans as completed implementation.
- Targeted read-only searches for `GAO-27-108661` or `zero trust` in news_items, research_inbox, sources, and news_articles each returned **0 matches** at inspection. These are literal-match checks, **not** a proof of no semantic duplicate.
- Proposed review tags: `government-oversight`, `cybersecurity`, `digital-rights`; cross-reference the agency-specific recommendations only where a documented source supports it. Do not create 40 duplicate case files.

## Live read-only pipeline checkpoint

- `news_items`: **882**, all pending editorial review (**+1** from the previous 881-record check), latest discovery **2026-11-21 18:06 UTC**. Last item ID **20484**, COVID-19 Updates; its title names Bioengineer.org and its saved URL is a Google News proxy, with no publication date. Do not treat publisher identity, publication date, and scientific substance as verified from an RSS headline.
- **414** news items lack `published_at`; **395** contain `news.google.com` URLs.
- `research_inbox`: **40** records, all pending; **25** have exact `source_url` overlaps with news items. These can be intentional representations of different editorial workflows, not proven duplicates.
- `sources`: **285**, with **146** missing publisher, **215** missing publication date, and **1** missing URL.
- **36** active news topics; **11** have no news items. All **11** active research-watch timestamps are more than seven days old; all **7** news-watch `last_collected_at` fields are null.
- Exact repeated URL groups: **0** within news items and **0** within sources; **8** groups of matching long news headlines merit manual review. The separate 17-article collection still has **0** article-topic links.
- Positive News collector latest run was **pending at 2026-11-21 18:15 UTC**, so no success/failure outcome was assumed for that run. Its most recent recorded success was **2026-11-11 16:46 UTC**. The COVID-19 feed's latest completed run saved **1** news item; six other feeds' latest completed runs saved **0**.
- SQL used exclusively `SELECT` against production. A timestamp updated by external collection is not attributed to this review.

## Review-branch code privacy hardening

- Existing `scripts/review-source-urls.mjs` now uses normalized URLs strictly **inside** its matching logic, and emits **record IDs and diagnostic flags only**. This avoids leaking opaque tokens embedded in URL paths and unrecognized query keys when exporting audit reports.
- Duplicate candidates remain human-review prompts based on exact conservative normalization (preserving functional document identifiers). Unsafe source URLs are still excluded; no URL is displayed or silently corrected. Invalid/untrusted record IDs are replaced with row ordinal labels instead of echoing arbitrary strings.
- Updated the existing test expectation and added a regression test with an **unrecognized opaque credential** in a URL path/query. A representative local Node 22 check of the edited logic passed **5/5** focused cases; the complete GitHub test suite and CI have not been run or verified.
- **Suggested follow-up:** collect original publisher metadata, article timestamps, and feed access diagnostics in a separate review-only queue. Implement the feed access-challenge classification inside the actual collector only after identifying that collector's repository and adding integration tests; **do not** bypass provider restrictions.

**Decision:** stage for editorial validation, no automatic publication or production changes.
