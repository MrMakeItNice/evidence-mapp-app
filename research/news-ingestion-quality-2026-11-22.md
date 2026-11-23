# Evidence Atlas — ingestion quality checkpoint (review only)

**Checked:** 2026-11-23 02:20 UTC (November 22, 2026, 6:20 PM Pacific). All Supabase inspection was read-only against project `nxlffnplqdobfqxogmxo`. No research published, no collector settings changed, no database writes or migrations.

## Observed health

| Read-only metric | Result |
| --- | ---: |
| Pending news items | 977 |
| News discovered in past 24 hours | 58 |
| Pending news older than 14 days | 135 |
| News with missing publication timestamps | 471 |
| Undated Google-News-proxy items (publisher/domain indicator) | 452 |
| Research inbox pending | 40 |
| Inbox items without watch-topic assignment | 4 |
| Inbox items without related case | 39 |
| Published-marked source records missing publication date | 53 of 123 |
| Exact news/inbox URL overlaps | 25 |
| Exact news/source URL overlaps | 5 |
| Exact same-table URL duplicate groups (news, inbox, sources) | 0 |
| Active news topics without direct news items | 11 of 36 |
| Research watch timestamps stale/blank | 11 of 11 |
| News watch timestamps stale/blank | 7 of 7 |

**Time-zone correction:** Two BBC news items have publication timestamps after **00:00 UTC November 23**, but before this audit's **02:20 UTC** execution. They are **not future-dated**. Comparing timestamp values to `now()::date` would generate false alerts. The offline diagnostic compares exact instants using explicit-offset timestamps.

**Collector telemetry:** Six of seven active feeds had recent successful completions. Positive News had **41 completed HTTP 403 responses** in the preceding 24h and no recorded success since November 11; its newest run was pending during this check. COVID-19 Google News had **one HTTP 429** but subsequently succeeded. The watch-topic timestamp fields should be treated as metadata health indicators, not proof that collectors stopped.

## Proposed safe audit implementation

`scripts/audit-news-ingestion.mjs` accepts a **complete, local** JSON snapshot covering news, inbox, source library, topics, watches and feed status, with `expected_counts` and an offset-aware `as_of` instant. It refuses incomplete snapshots, flags exact URL overlaps without stripping document-specific query parameters, counts missing dates, separates watch timestamp staleness from actual feed-success timestamps, and emits aggregate figures and numeric IDs only. It never requests network data, mutates records, or publishes content. All locally exported snapshots must remain private and **must not be committed**.

Seven focused tests cover count accuracy, timestamp-zone comparisons, query-selected document identity, duplicate URLs, incomplete exports, watcher-vs-feed status and invalid dates. Review-only GitHub Actions verifies syntax and tests on the PR.

## Original government sources newly staged for editorial review

**GAO-27-109072 — Medicare: HHS and CMS Should Better Manage Fraud Risks.** Official report: https://www.gao.gov/products/gao-27-109072 . **Published and released November 18, 2026.** GAO found that CMS's Medicare Fee-for-Service vulnerability management approach did not comprehensively identify and assess fraud risks; it made four recommendations, with HHS agreeing to three and disagreeing with one. **Evidence distinction:** weaknesses in risk assessment are not proof that a specific supplier committed fraud or that the amount of losses is established by this report. Proposed queue: public-health oversight / government spending.

**GAO-27-108414 — Veterans Crisis Line: Actions Needed to Improve Services Provided After Initial Contact.** Official report: https://www.gao.gov/products/gao-27-108414 . **Published and released November 18, 2026.** GAO identified gaps in advance identification of emergency-response alternatives and in tracking successful follow-up contact and care connections; VA concurred with two recommendations. **Evidence distinction:** data-collection gaps do not establish that all follow-up services failed or that specific adverse outcomes were caused by the gaps. Proposed queue: veteran support services / system accountability.

Targeted read-only identifier, title-phrase and official-URL checks found **zero direct matches for these two reports** in `news_items`, `research_inbox` and `sources`. This does not exclude alternate references, duplicate stories or related research under different names. **Human source verification and editorial approval are required before any ingestion, linking, or publication.**

## Release boundary

This PR is a standalone draft for review. **No production database schema/data changes, deployments, collector configuration changes, merges, or automatic publications**. Existing hourly monitoring schedules were left unchanged.
