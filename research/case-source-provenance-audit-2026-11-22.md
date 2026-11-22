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

## Follow-up: 2026-11-22 18:03 UTC / 10:03 Pacific (read-only)

### Cross-register/source-link identity and provenance

A fresh SQL join found **219** case/register references but **218 distinct (case_id, source_id) relationships**. Exactly **one underlying case/source pair** is represented through two register IDs: case **26**, source **26**, register IDs **32 and 46**. This is a catalog-identity review item, not an assertion of duplicate facts, duplicate original documents, or a reason to delete references. **23 underlying sources** are each associated with more than one case; this measures reuse, not corroboration or evidentiary independence. A source may be legitimately reused.

Only **5 of 140** published cases have a single linked record that is marked published and contains a nonblank publisher, publication date, and URL; **135** do not. The latter cases may nevertheless link to genuine original records. Existing checks that allow a publisher on one linked source and a date on another could wrongly appear sufficient for combined provenance. The diagnostic now adds a *same-record* completeness measure, underlying source-pair deduplication, and IDs of repeated register links (capped), without changing any source or case.

Fresh operational inventory at 18:03 UTC: 937 pending news / 56 discovered within 24 hours / 444 missing publication dates (425 Google News proxy URLs); 135 pending news older than 14 days; 40 research-inbox records pending (4 undated, 4 without assigned watch); 53/123 published-flagged sources undated; 25 exact news/inbox overlaps and five news/source overlaps, with no within-table exact URL duplicate groups. Active topic gaps 11/36, stale research-watch timestamps 11/11, stale news-watch timestamps 7/7. Distinct `news_articles` count 17, `news_historical_connections` count four, **14 news articles without a historical link** (three connected; link cardinality differs from connected-article count).

Collector feed status at check time: Positive News's last feed summary remains an error and last successful run November 11. Five BBC/Gaza feeds had successful most recent completions; COVID Google News last shown as *pending* at 18:00 UTC following a 17:26 UTC success; Epstein Google News last completed successfully. Do not count a pending run as a failure. No access bypass or collector configuration change attempted.

### Additional official sources identified for human review

**NARA/OGIS FOIA Advisory Committee recommendations dashboard** — https://www.archives.gov/ogis/foia-advisory-committee/dashboard ; officially labeled last updated **November 20, 2026**. This primary administrative status dashboard records 78 historical recommendations, 35 completed, 18 in progress, 20 pending, four deferred and one rejected. The 11 recommendations from the 2024–2026 committee term are currently pending Archivist review. A dashboard status is **not proof of agency compliance** or evidence of deliberate concealment; examine recommendation-level records and implementation documents separately. Candidate link: research watch **#2, Declassification and oversight**; do not create a second source for the same recommendation. Validate status transitions from snapshots before making trend claims.

**GAO-27-108665, Immigration Detention: ICE Should Determine Cost Effectiveness of New Initiatives Before Continuing** — https://www.gao.gov/products/gao-27-108665 ; **published/released November 19, 2026**. GAO reports that ICE acquired 11 warehouses for approximately $1.07 billion then planned to sell seven; it found ICE's detention spending plan had not been updated for the changed acquisition strategy and life-cycle estimates were missing. GAO made two recommendations, both marked **open** on the official page; DHS concurred. GAO's audited findings are stronger than speculation about intent: do **not** equate planning shortcomings with established fraud or suggest a final waste amount without comparing acquisition/disposal records, agency responses and follow-up evaluations. Candidate link to government oversight and public spending; research review before new case creation.

Targeted exact URL/identifier/title-phrase searches in `news_items`, `research_inbox`, `sources` and case titles returned **zero direct hits for each lead**. This does not exclude variants, indirect citations, related cases, or preexisting GitHub editorial memos. **Both leads staged here only**, not inserted into the production research inbox.

### Engineering delta, review and limits

The offline case-source diagnostic now distinguishes **register references (219)** from **distinct case/source relationships (218)**, flags repeated underlying sources by numeric IDs, counts sources reused across cases, and requires publication flag plus publisher plus date plus URL **on one linked record** for the stricter metadata metric. Four additional focused regression tests exercise repeated links, shared sources and metadata spread across multiple records. This is a *provenance triage* aid, not a document authenticity assessment. No snapshot data, source URLs, secret notes, automatic claim scores or proposed production writes are emitted by the diagnostic.

## Follow-up: 2026-11-22 18:40 UTC / 10:40 Pacific (read-only)

### Source URL identity and data-integrity spot check

Fresh production read-only checks: **937/937 news pending**, **55 discovered in the last 24h**, **444 undated news** (previously observed 425 Google News proxies), **135 news older than 14 days**; research inbox **40 pending, 4 undated, 4 unassigned**; **53 of 123** published-marked sources undated. Exactly **25** news/inbox and **5** news/source URL overlaps; **zero** within-table exact URL duplicate groups. **11/36** active topics have no news; **11/11** research watches and **7/7** news watches have stale/null timestamp fields, which by itself is not evidence their collectors stopped.

The case/register linkage still has **219** links and **one** repeated underlying case/source pair. A limited SQL URL-syntax audit found **0 missing or malformed HTTP(S)-prefixed URLs among the 219 linked references** and **0 such URLs in news_items or research_inbox**; **0 future-dated publications** in either news or inbox. This regex screening does **not** establish document availability, correct provenance or trustworthiness. The offline diagnostic now explicitly distinguishes a syntactically valid HTTP(S) citation URL from non-web, whitespace-bearing, malformed or credential-bearing strings, and requires a usable web URL in same-record complete-provenance checks. Invalid URLs produce review flags, not automatic repairs. Five added regression cases verify invalid schemes, credentials, whitespace, missing versus malformed references, and valid HTTPS URL query/fragment handling.

Latest feed summaries: Positive News remains **error** with a challenge-page response and last known success on **November 11**. Government BBC, World BBC, Public Health BBC, Gaza Google News and COVID-19 Google News show successful recent runs; the Epstein feed had a run **pending at 18:40 UTC**, so that run cannot yet be categorized as successful or failed. No access controls were bypassed.

### Additional original-document research leads

**GAO-27-107854 — Military Education Benefits: DOD Should Take Steps to Ensure Service Members Receive Information About Tuition Assistance.** Original GAO page: https://www.gao.gov/products/gao-27-107854 . **Published and publicly released November 20, 2026.** GAO found that Navy and Air Force base-orientation policies did not require information about tuition assistance as prescribed by DOD guidance. The DOD office said it treats this as a guideline rather than a requirement. GAO issued two recommendations, presently marked **open**; DOD agreed and described implementation steps. These are oversight findings about inconsistent information practices, **not proof that benefits were intentionally withheld**. Suggested cross-link: access to benefits, military education, agency policy compliance. Confirm subsequent implementation before claiming remediation.

**GAO-27-108923 — Small Business Research Programs: Selected Agencies Address Foreign Risks and Take Various Approaches to Track Data.** Original GAO page: https://www.gao.gov/products/gao-27-108923 . **Published and released November 19, 2026.** Five selected agencies reported reviewing **over 28,000 proposals** during FY2024–FY2025 and identifying **over 1,700 possible foreign risks**. Those are *screening flags*, not proven cases of espionage, and not a population-wide estimate. The GAO review notes different tracking approaches (spreadsheets and automated systems), which is relevant to provenance, data interoperability, and consistent source-linkage procedures. Proposed cross-link: research-grant transparency and agency data controls, after editorial review.

Targeted exact identifiers, official URL substrings and title-phrase queries against **news_items**, **research_inbox**, and **sources** found **no direct matches** for either new report. This does **not** exclude related entries or variants elsewhere. Stage these two reports **here only**; do not publish or insert into production. Do not count an agency report as independent corroboration of its own summarized findings.

### Limits

These checks read production and create draft-branch review artifacts only. URL syntax is not a live link check; source status is not source veracity; timestamp staleness is not proven collector downtime. Focused unit/CI checks do not replace a full application review. **No production schema/data, collector schedule, merge, deploy or published content changed.**
