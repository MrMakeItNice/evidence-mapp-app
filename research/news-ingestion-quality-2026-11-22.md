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


---

## Follow-up checkpoint — November 23, 2026, 02:38 UTC (November 22, 18:38 Pacific)

Fresh **read-only** SQL against project `nxlffnplqdobfqxogmxo` confirms **977** pending news items, **58** new in the preceding 24h, **471** missing publication dates (**452** Google News proxies and **19** other items). This is the most actionable date-quality split: manually prioritize checking the 19 non-Google entries against publisher originals; do not infer dates from discovery timestamps or overwrite data automatically.

Other current counts: **40** inbox pending (**4** undated, **4** with no research-watch assignment, **39** without a case relation); **53 of 123** published-marked sources lack publication dates and **1** has no publisher; **25** exact news-to-inbox URL overlaps, **5** news-to-source overlaps, and **0** within-collection exact URL duplicate groups. All **36** news topics are active, with **11** having no direct news items (numeric topic IDs **1, 2, 14, 21, 22, 26, 27, 31, 32, 33, 34**). All seven news-watch collection timestamps are blank and all 11 research-watch timestamps are older than 24h or blank; these metadata fields do **not** establish collector inactivity.

In the retained 24-hour feed-activity records, Positive News shows **41 completed HTTP 403 responses** and no successes; its last successful collection was November 11. The six other feeds have recent successful runs; COVID-19 Google News shows **one HTTP 429** followed by successful collection. Do not bypass access restrictions. Follow up on authorized alternate source feeds and date-metadata extraction.

### New review-only primary-source candidates (not ingested or published)

1. **GAO-27-109184, Science & Tech Spotlight: AI Chatbots and Mental Health** — official source https://www.gao.gov/products/gao-27-109184 ; **published and released November 20, 2026**. GAO discusses clinical-authorization limitations, uncertain effectiveness, privacy, sycophancy and both opportunities and safety risks. It is a technology assessment and policy discussion, **not clinical proof** that any specific chatbot caused a particular outcome. Candidate queue: digital rights / public health / AI accountability.

2. **GAO-27-108458, AI and Cybersecurity: Technologies Can Magnify Cyberattacks and Enhance Cyber Defense** — official source https://www.gao.gov/products/gao-27-108458 ; **published and released November 20, 2026**. GAO evaluates AI-enabled offensive and defensive capabilities and identifies **16 potential policy options** across four goals. Its cited incident examples include industry-reported evidence: do not recast them as newly independently verified forensic findings. Candidate queue: cybersecurity / source-integrity risk / AI safety.

3. **SEC Press Release 2026-116, Backward Hat Capital enforcement announcement** — official source https://www.sec.gov/newsroom/press-releases/2026-116-sec-charges-indianapolis-based-backward-hat-capital-its-co-founders-560-million-dollar-offering ; **November 20, 2026**. The SEC says it obtained temporary judicial relief and **alleges** an approximately $560 million offering fraud and fabricated independent audit reports. The civil complaint's accusations must be explicitly marked **allegations**, not judicially established misconduct; independently examine the docket/order before promoting judicial-finding claims. Candidate queue: financial integrity / evidence authenticity.

Targeted read-only database identifier/title/official-URL searches found **no direct matches** for these three primary leads in the news, inbox, or source-library collections. Alternate URLs or coverage under different names may still exist. No source or case record was written.

### Follow-up code changes on this draft PR

The offline audit now distinguishes undated **non-Google** news and outputs only a capped, sorted list of numeric IDs for human triage (no headline or URL content), exposes the IDs of uncovered active news topics, validates that inbox watch-topic references exist in the supplied complete snapshot, and counts published-marked source records missing publisher metadata. Four extra focused tests were added; the full suite now contains **11 tests**. CI verification must be checked at the current head before reporting a pass.

**Release boundary unchanged:** no production database writes, schema migrations, collector reconfiguration, merges, deployments or publication.
