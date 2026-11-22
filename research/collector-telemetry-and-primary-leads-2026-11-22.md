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
