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


---

## Follow-up checkpoint — November 23, 2026, 03:49 UTC (November 22, 19:49 Pacific)

Read-only database inspection confirms **980 of 980 news items pending**, **58 discovered in the preceding 24 hours**, **474 news items with no publication timestamp** (455 Google-associated proxies and 19 other items), and **135 pending for more than 14 days**. The **40-item research inbox is entirely pending**: 36 entries have been pending longer than 14 days, with no records discovered in the preceding 24 hours; four lack a watch-topic assignment and four lack publication dates. All date-quality gaps remain review candidates: never infer a source publication date from a discovery timestamp.

Among the **123 published-marked source records**, 53 lack a publication date, one lacks a publisher, and **one lacks any source URL**. The basic HTTP(S)-scheme and whitespace check found zero malformed nonblank URLs in news, inbox, or published-marked sources. This is **syntax screening only**, not a fetch, link-resolution or authenticity check. Exact URL overlaps remain 25 news/inbox and five news/source rows, with no within-collection exact-URL duplicate groups; query-dependent document identifiers must be preserved rather than discarded. All 36 news topics are active, 11 without direct news items; all seven news-watch timestamps are blank and all 11 research-watch timestamps are stale, though those fields alone do not prove collection stopped.

**Collector telemetry:** Six of seven active feeds have successful recent runs as of the 03:49 UTC checkpoint. Positive News's most recent stored status is an error with an HTML access challenge; its last success was **November 11, 2026**. No access challenge was bypassed. The other six feeds report successful recent completions; their latest saved-item counts should not be equated with polling success or source verification.

### Newly staged original government reports (review only)

**GAO-27-108744 — Federal Prisons: Improved Reviews of Natural Deaths and Communications with Families Needed.**
Official original report: https://www.gao.gov/products/gao-27-108744 .
**Published and publicly released November 16, 2026.**
GAO examined Bureau of Prisons natural-death records, found documented health-care deficiencies in **45% of fiscal-year 2024 cases reviewed**, and made 13 recommendations concerning investigations, family notifications, and tracking recommendations. GAO reports approximately 3,000 natural-cause deaths in federal custody in FY2016–FY2025. These are GAO findings based on the agency records and its selected reviews, **not evidence that every death was preventable, criminal or intentionally concealed**. Suggested review queues: custody oversight / justice / verified death investigations. Before linking to individual cases, obtain the relevant primary records and respect family privacy.

**GAO-27-108683 — Space Supply Chains: Additional DOD Actions Could Strengthen Its Enterprise Approach for Managing Risks.**
Official original report: https://www.gao.gov/products/gao-27-108683 .
**Published and publicly released November 17, 2026.**
GAO inspected three Space Force programs and found component-supply risks and coordination gaps, including missing clearly designated leadership for enterprise risk-management work. DOD concurred with three recommendations. This documents **supply-chain and coordination risks**, not deliberate satellite disruption or evidence of an undisclosed operation. Suggested queue: space systems / government oversight / satellites; avoid implying the report describes any specific commercial satellite company not named in the report.

Targeted read-only checks for report identifiers, official URL patterns and distinctive title phrases returned **no direct matches** for either report in `news_items`, `research_inbox` or `sources`. Related reporting or alternate document URLs may exist. No records created, linked, rewritten, or published.

### Review-only engineering change

Added optional offline **citation URL syntax diagnostics** for news, inbox and published-marked sources. Diagnostic output exposes aggregate counts and capped numeric IDs only; it flags missing URL, unsupported scheme, whitespace, malformed URL and embedded credentials without making network calls. It preserves complete query strings for identity decisions. Added capped **older-than-14-days research-inbox numeric ID triage** to distinguish aged pending items from reviewed or recent ones. Four new focused tests cover this behavior (total **15**), with CI verification to be confirmed separately.

**Safety boundary unchanged:** no production SQL mutations or migrations, no collector changes or bypass, no deployment, no merge, no automatic research publication.


---

## Follow-up checkpoint — November 23, 2026, 05:11 UTC (November 22, 21:11 Pacific)

All database reads were SELECT-only. **980/980** news items remain pending; **58** were discovered in the preceding 24h, **474** lack publication timestamps (**455** Google-associated proxies and **19** other records), and **135** are pending longer than 14 days. The research inbox has **40/40 pending**, including **36** older than 14 days, **4** undated and **4** without watch-topic assignment. **53/123** published-marked source records lack publication dates and **one** lacks a source URL. Eleven of 36 active news topics have no directly associated items. All 11 research-watch and seven news-watch metadata timestamps remain stale/blank; **do not equate these fields with collector inactivity**.

A targeted, publisher-label-only breakdown of the **19 non-Google undated records** found **12 Associated Press**, **1 Reuters**, and **6 labeled as government, inspector-general or international-court sources**. These labels guide a manual first-pass source check; they **do not verify original publication dates**. No dates were inferred from discovery times or written to production.

**Collector health, new distinction:** All seven feeds are active and six have a successful poll within 24h, yet **two have a latest stored error state**. Positive News has not successfully collected since **November 11**; **32** completed 403 access-challenge responses were recorded in the preceding 24h. Epstein Files — Google News recorded an HTTP 429 rate-limit response at **04:36 UTC**, despite an earlier successful HTTP 200 at **04:01 UTC**; a new attempt at 05:10 UTC was still pending during inspection. This is **intermittent rate limiting**, not evidence that the collector has been down all day. Other feeds have more recent successful completions. No access challenge was bypassed and no configuration changed.

**Cross-source provenance review:** 25 exact news/inbox URL overlaps, five exact news/source URL overlaps and zero within-table exact URL duplicate groups. The case register, relationship graph and claim path contain **388 distinct case/source pairs**, but **81/140** published cases still lack complete marked-published direct-source metadata through the two assessed direct citation paths. These metrics do not assess document authenticity or validate a claim.

### New agency primary-source candidates (review only; not published)

**GAO-27-108971 — Federal Data Centers: Congress Has an Opportunity to Improve Agencies' Acquisition and Operations.**
Official page: https://www.gao.gov/products/gao-27-108971 . **Published and publicly released November 18, 2026.** GAO reviewed data center practices at 21 agencies and found that **none had fully addressed all five** selected OMB requirements as of August 2026. GAO proposed that Congress consider reauthorizing or replacing an expired 2023 law. **Limits:** The fifth requirement concerned new data centers and was inapplicable at many agencies. This audit is not evidence of a particular breach or deliberate security weakness. Suggested queue: digital infrastructure / water-energy use / federal oversight.

**GAO-27-109529 — VA Electronic Health Record Modernization: System Deployed to 13 Sites in 2026 and Work Planned to Continue at an Accelerated Pace.**
Official page: https://www.gao.gov/products/gao-27-109529 . **Published and publicly released November 18, 2026.** This is GAO testimony describing **13 deployments in 2026** and **26 planned for 2027**; GAO says **11 of 18** recommendations from five earlier reports had not been fully implemented. **Limits:** Some findings rely on preliminary ongoing work and VA-reported performance observations; the testimony is not independent confirmation of service outcomes or a new finding for each previously identified concern. Suggested queue: veterans' services / healthcare IT accountability.

Targeted read-only searches of news_items, research_inbox and sources returned **zero direct matches** for these two report identifiers, official URL fragments or selected title phrases. This is not proof that there is no alternate-format or related coverage. Human reviewers must inspect full original reports, check existing case relevance, and preserve source identity and evidence-type distinctions before publication or linking.

### Review-only implementation and verification

The offline diagnostic now separately flags **latest feed error with a successful collection in the preceding 24 hours** versus **latest feed error with no successful collection in that window**. It emits aggregate counts and capped numeric feed IDs, not feed names, error HTML, or private source text. This is a triage signal, not a substitute for checking complete activity logs. Three regression tests cover transient error, persistent error and recovered/healthy status.

**18 focused regression tests and Node syntax checks passed** on code/test commit 034aa271b1dd908e18535e24aacb52be5947788f in https://github.com/MrMakeItNice/evidence-mapp-app/actions/runs/45116252888 . Full application/browser testing remains outstanding.

**Safety boundary:** No production database writes or schema changes, no collector configuration edits, no access bypass, no automatic ingestion/publication, no deployment and no merge.
