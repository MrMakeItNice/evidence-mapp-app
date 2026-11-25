# Evidence Atlas research review — 2026-11-22 UTC

**Status: editorial review required. Nothing approved or published.** Production project: nxlffnplqdobfqxogmxo.

## Read-only research and ingestion snapshot

Checked in the 2026-11-22 05:00 UTC hour. Aged counts use discovery timestamps, **not** original publication dates.

- News queue: **922 pending**; **488 older than seven days**, **134 older than fourteen days**. Latest discovered item: 2026-11-22 02:46 UTC.
- Research inbox: **40 pending**, all **40 older than seven days**, **36 older than fourteen days**; newest discovery 2026-11-10 20:28 UTC.
- News publication dates missing: 440/922, including 421 Google News proxy entries. Source library: 146/285 missing publisher, 215/285 missing publication date, one missing URL. Unknown dates must stay unknown until checked against original documents.
- Exact trimmed and case-insensitive duplicate URL groups: zero within news, zero within sources. **25 inbox entries** have an exact news-item URL match; this is potential cross-queue correlation, **not** evidence that either record should be deleted.
- Eleven research-watch check timestamps are stale (last updates Nov 2 or Nov 11); all seven active news-watch collection timestamps are blank. Thirty-six news topics remain active.
- Positive News status remains error, last success November 11. In the filtered 24-hour collector activity, **33 retained Positive News rows** are HTTP 403 failures. Retained history is incomplete, so this is not a comprehensive count of attempts. Other six collectors have recent successful runs; their activity rows reported 48 saved records in aggregate. These 48 are not independently validated distinct news articles.

## Recent official primary-source candidates — not ingested

Targeted identifier searches over source-library titles/URLs, news titles/URLs and inbox titles/URLs found **no direct report-number matches** for the three below. This is not proof that related material does not exist under another name or in descriptions.

### GAO-27-108665 — Immigration Detention
Published and publicly released **November 19, 2026**. Primary document: https://files.gao.gov/reports/GAO-27-108665/index.html

GAO says ICE acquired 11 warehouses for about $1.07 billion but planned to sell seven; it recommended updated spending plans and life-cycle estimates. **DHS concurred** with both recommendations. Avoid characterizing a procurement oversight finding as proven fraud or criminal misconduct. Check the updated agency response before publication.

### GAO-27-108656 — Food and agriculture cybersecurity
Published and publicly released **November 19, 2026**. Primary document: https://files.gao.gov/reports/GAO-27-108656/index.html

GAO found USDA and FDA met most evaluated cybersecurity requirements but did not fully meet five in information-sharing and emergency-preparedness areas. Of five recommendations, **HHS agreed with three**, **USDA disputed two**; GAO maintained the latter two. Distinguish documented incidents from hypothetical cyber-risk scenarios.

### GAO-27-107934 — Federal digital accessibility
Published and publicly released **November 19, 2026**. Primary document: https://files.gao.gov/reports/GAO-27-107934/index.html

GAO submitted covert feedback to agencies between September 2025 and February 2026; **14 of 23 agencies** fixed the issues GAO identified, and **nine had not** as of May 2026. GAO recommended improvements at USDA and HUD; both agencies neither agreed nor disagreed. The evaluated sample is not a census of all federal websites.

## Editorial steps

1. Verify report ID, publication/release date, canonical URL, report claims, limitations and agency responses against the originals.
2. Search for semantic duplicates in existing cases and citations before assigning source IDs or linking records.
3. Triage discovery-aged backlog by relevance and timeliness without converting missing publication dates into assumptions.
4. Address Positive News HTTP 403 through authorized provider access or compliant alternative sourcing, never access-control bypass.

## Engineering boundaries

The companion offline utility audits a **complete user-supplied local snapshot** for queue aging and unexpected timestamps. It outputs **aggregate counts only**, rejects truncated exports, never reads Supabase or the network, and makes no record changes. No production writes, schema changes, merges, deployments or automatic research publication occurred.
