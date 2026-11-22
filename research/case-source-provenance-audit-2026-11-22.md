# Editorial audit — case/source provenance coverage
**Observation time:** 2026-11-22 16:33–16:37 UTC (November 22, 08:33–08:37 Pacific)  
**Scope:** Read-only Supabase queries in nxlffnplqdobfqxogmxo; branch-only review artifacts.  
**Status:** Internal research and editorial review only. Nothing published or merged.

## Key provenance discovery
- 143 cases, **140 flagged published** and 3 draft.
- All **140 published cases have at least one case_source_references link**, but this is only *catalog coverage*; it is not necessarily a reviewed, publicly visible, dated citation.
- The 219 case-register reference links resolve to **146 distinct source records**.
- **214 of 219 links target source records not marked published**, undated, and without an attributed publisher (some sources are reused across cases).
- **135 of 140 published cases have no linked source record marked published**. The remaining five cases link to the *same* marked-published U.S. Senate MKULTRA record (source ID 1).
- **135 of 140 published cases also lack any linked dated source or publisher-attributed source**. Yet all 219 links have HTTP(S)-prefixed URLs; do not mistake missing metadata for absent link targets.
- The 3 cases lacking case-source references are **unpublished drafts**. The incomplete draft case titles must not be promoted as findings.
- The 146 distinct referenced sources comprise 145 not marked published and one marked published; this is different from the entire 285-source library, which has 123 published-marked sources.
- Sources marked unpublished may still point to genuine government primary records; the boolean is an editorial status field, *not* a verdict that the underlying document is false.
- Prioritization: review actual source documents, dates, publisher attribution, official context and scope before declaring published cases fully sourced. Do not auto-flip `sources.published` or suppress cases without editorial review.

## Wider inventory and collector audit
- 937/937 news items pending, including 56 discovered in 24h; 444 missing publication dates; 135 pending more than 14 days.
- 40 inbox entries pending, 4 undated, 4 unassigned.
- 53 of 123 published-marked library sources lack dates; source 285 lacks URL and publisher and should be reviewed, not silently deleted.
- 25 exact URL news/inbox pairs and 5 news/source pairs; zero repeated exact URL groups within either news or source table. Exact URLs are possible links, not independent corroboration.
- 11/36 active news topics have no items; 11/11 research watches and 7/7 news watches have stale collection/check timestamps, which do not alone establish that collectors stopped.
- Positive News: 41 **observed** completed HTTP 403 failures within retained preceding 24-hour activity; last success November 11. One COVID-19 Google News 429 recovered in subsequent completed success. Six other feeds have recent successful completions, while one last run was pending at observation time.
- Separate `news_articles` has 17 items and `news_article_topics` has no links; those rows are distinct from `news_items`.

## Fresh government primary-source leads for review

### SEC proposal S7-2026-40 — November 20, 2026
Official proposed rule: https://www.sec.gov/rules-regulations/2026/11/s7-2026-40  
Press release: https://www.sec.gov/newsroom/press-releases/2026-117-sec-issues-proposal-restructure-consolidated-audit-trail

SEC proposed transferring Consolidated Audit Trail governance and funding to the Commission under proposed Rule 17a-26, while rescinding Rule 613; its announcement describes continued collection of substantially the same market-audit data. This is **proposed, not final**. The comment period is stated relative to Federal Register publication (60 days), not an invented calendar deadline. Agency statements about privacy protections and cost savings should remain attributed to SEC pending analysis of rule text, public comments and independent oversight. Connect after review to financial-market transparency, government data holdings and privacy topics.

### GAO FY2026 accountability report: oversight access limits — November 16, 2026
Official accessible HTML report: https://files.gao.gov/reports/GAO-27-900726/index.html

GAO reports **43 FY2026 engagements across 17 agencies** needing senior leadership intervention over access to information, compared with **14 engagements across 11 agencies in FY2025**, and describes broader constraints with OMB, Commerce, SEC and USAID. This is **GAO's documented account of oversight-access disputes**, not proof that all withheld information was unlawfully concealed. Check the original GAO report, GAO statutory authority, and agency responses. The report was already recorded in an earlier Evidence Atlas staging memo for a separate financial-benefits angle; **cross-link to that lead rather than treating it as an independent new source**.

A targeted exact ID/title/URL search of `news_items`, `research_inbox` and `sources` yielded no matches for the SEC proposal or GAO report. This is not an exhaustive search of all case text or all variants.

## Offline implementation and release boundary
The new `scripts/audit-case-source-coverage.mjs` requires complete exported local snapshots and reports link/metadata coverage by **numeric IDs and reason codes only**. Includes strict join validation and caps output to 50 flagged IDs. It neither infers credibility nor makes any database changes. No private data snapshots should be committed.
- New focused Node tests and a PR-scoped, read-only CI workflow; full app/browser tests remain separately required.
- Nothing has been merged, deployed, automatically published, or written to Supabase.
