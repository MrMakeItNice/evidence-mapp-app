# Editorial staging: collector telemetry and primary records
**Read-only inspection:** 2026-11-22 14:04–14:06 UTC (06:04–06:06 Pacific)
**Project:** Supabase nxlffnplqdobfqxogmxo / Evidence Atlas
**Publication status:** Review only. Nothing entered or changed in production.

## Observed pipeline inventory
- News: 933 records, all 933 pending editorial review; 54 discovered in the preceding 24 hours; 134 pending more than 14 days since discovery.
- Publication timestamps absent on 441 news records, including 422 Google News proxy records.
- Research inbox: 40 pending, four missing publication dates, four lacking assigned watch topics.
- Published-flagged source records missing dates: 53; one published-flagged source without publisher and one without URL. Source ID 285 has multiple missing provenance fields; review, do not automatically delete.
- 11 of 36 active news topics contain no news; all 11 research watch topics and all seven news watch topics have stale or null last-check/collection timestamps using a 24-hour threshold.
- Exact cross-queue URL matches: 25 news ↔ inbox and five news ↔ sources; exact duplicate URL groups within news and within sources: zero. URL identity is not independent confirmation or proof the stories are the same investigation.
- News article topical link table remains empty; separate 17-row news_articles collection should not be confused with news_items.

## Collector observations
- Seven configured active feeds.
- Positive News: 41 **observed** completed HTTP 403 failures in the queried preceding 24 hours; latest recorded success is November 11 at 16:46 UTC. Retained history is not guaranteed complete. Do not bypass access controls; use an authorized feed, permission, or alternative provider after review.
- COVID-19 Google News: one observed HTTP 429 within 24 hours, followed by a completed HTTP 200 run at 13:56 UTC on November 22. Do not call this an ongoing outage.
- Public Health BBC: latest completed run succeeded and saved one item; the latest discovered news item was BBC report #23883. All collected items remain pending.
- Epstein Files Google News had a pending run at the previous instant, with a recorded completed successful run at 14:01 UTC. A pending state must never be treated as a failed run.
- Other latest completed feed runs succeeded. Successful collection with zero saved records is not an error.

## Newly found government-origin documents for human editorial review

### 1. DOJ ADA accessibility settlement — November 20, 2026
Primary official source: https://www.justice.gov/usao-mdga/pr/ada-settlement-requires-accessibility-improvements-cochran-bleckley-recreation

The U.S. Attorney's Office says the Cochran-Bleckley Recreation Department signed a Letter of Resolution on **November 18**, promising accessible parking, restroom and route improvements, with staged deadlines in February 2027 and July 2028. These are **commitments**, not proof the improvements were completed. Original agreement and subsequent compliance records should be checked before attributing results. A targeted exact URL / title-phrase search found **zero matches** in the inspected news_items, research_inbox and sources records. The broader case index was not exhaustively searched.

### 2. DOJ announcement of arrest in Mexico — November 21, 2026
Primary official source: https://www.justice.gov/opa/pr/senior-leader-sinaloa-cartel-and-one-fbis-ten-most-wanted-fugitives-arrested-mexico

DOJ reports the November 20 arrest of **Fausto Isidro Meza Flores** by Mexican forces and references September 25 U.S. charges. Alleged criminal conduct remains allegations, not adjudicated facts. Confirm independently with Mexican official records, docket documents and responses where available; distinguish arrest, indictment and conviction. A targeted exact URL / title-phrase search found **zero matches** in the three inspected research collections; that does not establish absence from all Evidence Atlas cases.

## Implementation proposed in this branch
- New offline `scripts/audit-collector-telemetry.mjs` accepts a full local JSON snapshot with explicit expected table counts, rejects duplicate IDs, missing references and invalid timestamps.
- Reports **observed**, not necessarily exhaustive, completed 24-hour response counts and separates repeated 403 access problems, isolated 429 rate-limits, stale/no known successful collection, pending runs, and zero-item successful polls.
- No database credentials, HTTP requests, SQL, production writes, publishing, or feed configuration changes. Error bodies, raw URLs and confidential notes do not appear in output.
- PR-specific 15-test regression suite and scoped read-only CI workflow. Tests must pass in GitHub before review; do not infer application or browser readiness from this suite.

**Review requirement:** This document records staging candidates, not verified cross-source investigations or approval to publish. No schema, production data, publishing status, merge or deployment should be changed.

## Follow-up evidence and engineering audit — November 22, 2026, 14:55–14:56 UTC

**Read-only inventory:** 934 of 934 news items remain pending (+1 since 14:04 UTC); 55 were discovered in the preceding 24 hours. 441 news items are undated, including 422 Google News proxy URLs. All 40 research-inbox records remain pending; four are undated and four lack watch-topic assignments. Of 123 published-flagged sources, 53 have no publication date; one lacks its URL and one its publisher. Eleven of 36 active news topics have no items; 11/11 research watches and 7/7 news watches have missing or older-than-24-hour update stamps. Exact news/inbox URL overlaps remain 25 and news/source overlaps remain five; no repeated exact URL groups were found within news or sources.

**Collector observations:** 344 activity rows were retained at query time, 287 completed within the query's preceding 24 hours (41 for each of seven feeds). Positive News accounted for all 41 of its observed HTTP 403 completions. One COVID-19 Google News HTTP 429 occurred during the same window, followed by successful later collection. Most other latest feed completions succeeded; Public Health BBC was pending at the 14:55 UTC snapshot. No contradictory telemetry rows were found: zero HTTP >=400 rows marked `ok`, zero completed runs marked `pending`, zero HTTP 2xx rows marked `error`. This is an audit of available retention, not proof that older logs are complete.

**Code improvement:** Added conservative handling for contradictory future collector telemetry. HTTP >=400 can no longer count as an observed successful completion merely because `status` says `ok`. The review-only output now flags `status_ok_with_http_error` and `completed_run_still_pending` for reconciliation. Two dedicated regression tests were added; no production fetch, credential, pipeline, collector configuration, database write, release or auto-publication is involved.

### New primary-source lead A — SEC / CFTC Backward Hat Capital matter

- SEC release **2026-116** (November 20, 2026): https://www.sec.gov/newsroom/press-releases/2026-116-sec-charges-indianapolis-based-backward-hat-capital-its-co-founders-560-million-dollar-offering
- CFTC release **9328-26** (November 20, 2026): https://www.cftc.gov/PressRoom/PressReleases/9328-26
- The SEC says its civil complaint alleges approximately **$560 million** raised from **more than 2,000 investors**; CFTC describes **more than $550 million** from **at least 2,100 participants**. Both describe parallel actions in the alleged enterprise, not independent confirmation of guilt. Preserve the distinct agency figures and distinguish allegations, temporary court relief, and any future adjudication.
- SEC states a temporary restraining order, asset freeze and related relief were obtained; CFTC reports a temporary receiver was appointed. These court-process events are distinct from final liability findings. Before publication, retrieve the complaints and orders, compare overlapping defendants and transaction/accounting scope, seek responses and court updates.
- Targeted title-phrase and SEC URL checks returned **zero direct matches** in `news_items`, `research_inbox`, `sources`. This does not establish absence from every case or external research source.

### New primary-source lead B — NARA GRS 4.5 digitization FAQ

- NARA authoritative FAQ (updated **November 2026**, exact day not provided): https://www.archives.gov/records-mgmt/grs/faqs-for-grs-4-5
- NARA explains conditional disposition of original source records after valid digitization or NARA acceptance, with important exclusions including certain pre-1950 permanent records, formats lacking applicable digitization standards, and intrinsically valuable originals. The digitized record remains subject to its applicable retention or permanent-transfer schedule.
- Research angle: compare the official schedule, 36 CFR 1236 and the relevant agency's disposition practices before any claim about destruction, digitization or inaccessible records. This FAQ is **not evidence of unlawful destruction**.
- Targeted title-phrase and exact FAQ URL checks returned **zero direct matches** in the same three research collections; a full case-index search was not performed.

**Editorial status:** Both leads are new unpublished review candidates, not verified multi-source investigations. All write operations in this checkpoint are confined to this draft GitHub PR; no production Supabase changes, merge, deployment or release.


## 08:25 Pacific / 16:25 UTC follow-up — read-only monitoring, collector recovery and primary leads

**Audit timestamp:** 2026-11-22 16:25:53 UTC. Queried production Supabase with SELECT statements only; no changes were made.

- `news_items`: 937 total and 937 pending, 56 discovered within preceding 24 hours, 135 pending more than 14 days since discovery. **444** have no `published_at`, including **425** URLs matching the Google News proxy-domain pattern (pattern-based attribution, not proof of publication date).
- `research_inbox`: 40 pending, four lacking `published_at` and four without a research-watch assignment.
- `sources`: 123 marked published; 53 have no publication date; one has no publisher; one has no URL. These missing values should not be guessed or backfilled from discovery timestamps.
- 11 of 36 active news topics have no associated `news_items`; all 11 active research watches have null or >24-hour `last_checked_at`; all seven active news watches have null or >24-hour `last_collected_at`. Those timestamp fields do not alone prove collectors stopped collecting.
- All 17 records in the separate `news_articles` table lack `news_article_topics` link rows; this table is distinct from `news_items`.
- No exact duplicate URL groups within `news_items` or `sources`; **25** direct `news_items`–`research_inbox` URL overlaps and **five** `news_items`–`sources` overlaps. These are potential links, not separate corroborating evidence and not automatic merge instructions.
- Collector activity: **362 rows retained**; in the 24-hour date-scoped query each of the seven active feeds had **41 completed** runs. Positive News had **41 observed HTTP 403** completions and no recorded successful collection since 2026-11-11 16:46 UTC. Its most recently dispatched run was pending at this audit instant; that pending status is not a completed failure.
- COVID-19 Google News had one observed HTTP 429 completion at 12:46 UTC followed by later successful HTTP responses, most recently 16:16 UTC; this does **not** support calling the feed currently blocked. The other five feeds had 41 observed recent successful completions each. Across retained activity, there were zero completed runs marked pending, zero HTTP >=400 successes, and zero HTTP 2xx responses marked errors.
- Retention and polling cadence are not guaranteed to show every attempt; numeric failure counts describe **observed** activity only.

### GAO primary research candidates — not published

**GAO-27-108458, _AI and Cybersecurity: Technologies Can Magnify Cyberattacks and Enhance Cyber Defense_ (November 20, 2026).** Authoritative report: https://www.gao.gov/products/gao-27-108458 . GAO summarizes how AI can strengthen cybersecurity while increasing phishing, deepfake and attack automation capabilities. It sets out **16 policy options** across four policy goals; these are options, **not enacted rules**. GAO's cited attack examples include third-party industry reporting: verify the underlying incident sources before treating those examples as independently established facts. Potential topic connections: cybersecurity, AI safety, information integrity and resilience. Exact identifier/title-phrase queries in `news_items`, `research_inbox`, and `sources`: zero matches in each; broader `cases` and external material not exhaustively searched.

**GAO-27-109184, _Science & Tech Spotlight: AI Chatbots and Mental Health_ (November 20, 2026).** Authoritative report: https://www.gao.gov/products/gao-27-109184 . GAO describes potential benefits and risks of mental-health chatbot use, including unproven efficacy, safety, privacy and sycophancy concerns; the publication says FDA had not authorized a chatbot for mental-health care as of November 2026. Preserve publication-date context and distinguish expert concerns from observed causal outcomes. Consider linking to AI governance and health-policy research after editorial and scientific-source verification. Targeted identifier/title-phrase queries in the same three collections: zero matches; **not** proof of absence from the full case corpus.

**Code improvement in this draft branch:** `audit-collector-telemetry.mjs` now distinguishes a 429 followed by a later observed success from a 429 without a later successful completion inside the observed 24-hour window. This prevents an older, already-recovered rate-limit response from being misrepresented as a current outage. Three regression tests cover chronological recovery, an earlier successful run that predates the 429, and a later second 429. These remain offline-only diagnostics; no live collector behavior, schema, production data or release configuration was modified.

**Editorial conditions:** Inspect the underlying GAO PDFs and cited supporting studies before publication; preserve qualified wording and competing explanations. These are review candidates only. Do not automatically create cases, connect claims, infer guilt, merge overlaps, or publish.
