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


---

## Follow-up checkpoint — November 23, 2026, 06:20 UTC (November 22, 22:20 Pacific)

**Read-only production audit:** 982/982 news items remain pending, 60 discovered in the preceding 24h, 135 pending over 14 days. **476** lack a publication timestamp: **457** are Google-associated and **19** are not. None have a publication timestamp later than the exact audit instant. The research inbox is **40/40 pending**, with **36** aged over 14 days, **4** undated and **4** unassigned to a research watch topic. **53/123** published-marked source records lack publication dates and one lacks a URL. All **36** active news topics were checked, **11** have no directly linked news items (some are editorial/methodology categories). All **11** research watch and **7** news watch last-checked timestamp fields are stale/blank, but live feed telemetry proves recent polling.

**Duplicate and provenance checks:** 25 exact news-to-inbox and five exact news-to-source URL-linked row pairs; **zero exact same-table URL duplicate groups**. Preserve query strings and never auto-merge records. The register and relationships graph contain 387 distinct direct case/source pairs, and the claim-linked path adds one novel pair for **388 distinct catalog pairs**, not independent corroboration. **81/140** published cases lack a complete marked-published source record with publisher, date and HTTP(S)-shaped URL in the two inspected direct linkage paths. This is a metadata review flag, not evidence that their claims are untrue.

**Collector health (retained 24h activity):** Six of seven active feeds have recent successful completions. Positive News had **34 completed HTTP 403** requests and zero HTTP 200 responses; the most recent status is an HTML access challenge and its last recorded success remains **November 11, 2026**. COVID-19 Google News and Epstein Files Google News each had one HTTP 429, plus 34 and 33 HTTP 200 completions respectively. Epstein's most recent feed record was *pending* during this audit, not a confirmed outage. No attempt to bypass access controls or alter feed configuration.

### Newly verified original-agency leads — editorial review only

**GAO-27-108923 — Small Business Research Programs: Selected Agencies Address Foreign Risks and Take Various Approaches to Track Data.** Original publication: https://www.gao.gov/products/gao-27-108923 . **Published and publicly released November 19, 2026.** GAO examined five selected agencies' small-business research-grant due-diligence programs, reporting **over 28,000** proposals assessed and **over 1,700 possible foreign risks** identified in FY2024–2025. **Limitation:** a flagged potential risk does not establish espionage, technology theft, or wrongdoing by an applicant; the five selected agencies are not the complete federal universe. Suggested queue: research integrity / federal grants / national security oversight.

**GAO-27-107854 — Military Education Benefits: DOD Should Take Steps to Ensure Service Members Receive Information About Tuition Assistance.** Original publication: https://www.gao.gov/products/gao-27-107854 . **Published and publicly released November 20, 2026.** GAO found Navy and Air Force orientation policies did not require providing tuition-assistance information at new bases as DOD policy directs, and made two recommendations, both open at publication. **Limitation:** its discussion groups are not a population-wide survey, and participation declines have multiple plausible causes; this finding does not show that every eligible service member was denied benefits. Suggested queue: public-service access / military education / policy accountability.

Targeted SELECT-only identifier, official-URL and distinctive-title searches across `news_items`, `research_inbox`, and `sources` found **zero direct matches** for either GAO report. Related stories, alternate identifiers or URLs may still exist. Both leads are staged **in this PR memo only**, not inserted into the database and not published. Human editorial review must check the original reports and related case context before linking or representing findings as facts.

### Review-only code enhancement

The offline news ingestion diagnostic now emits **capped, deterministically sorted numeric-only ID pairs** for exact URL matches between news/inbox and news/source catalogs. It also provides omitted-pair counts above the 25-pair limit. This makes 25 + 5 existing exact-match candidates actionable to reviewers without disclosing unpublished titles, sensitive text, raw URLs or credentials. Exact matching is conservative: distinct query-selected documents remain distinct, and the tool **never automatically connects or merges records**. Three new focused regression tests cover privacy, deterministic ordering, query identity and cap behavior (21 tests total, pending independent CI verification for this code revision).

**Release boundary:** PR remains draft and unmerged. No database writes, schema/data changes, deployments, automatic content publication, collector configuration changes, or access-challenge bypasses.


---

## Follow-up checkpoint — November 23, 2026, 06:48 UTC (November 22, 22:48 Pacific)

**Read-only audit of Supabase `nxlffnplqdobfqxogmxo`:** 983/983 news items pending review, 59 discovered in the preceding 24 hours, 135 pending more than 14 days, and 476 without publication timestamps (**457 Google-associated, 19 other**). The 40-item research inbox remains wholly pending: 36 over 14 days old, four undated, four without research-watch assignments. Among 123 marked-published sources, 53 lack dates and one lacks a URL. All 36 news topics are active; 11 lack direct news items, including corrections, legal frameworks and primary-document/editorial categories. All 11 research-watch timestamp fields are stale and all seven news-watch timestamps are blank. These timestamps do not prove collector inactivity.

**Source identity and metadata review:** 25 exact news-to-inbox URL pairs, five news-to-source pairs, **zero inbox-to-source exact URL pairs**, and no exact URL duplicate groups within the three collections. Among the 25 news/inbox exact URL pairs, **five have differing nonempty publisher labels** (including potentially legitimate name variants) and **zero have both publication instants more than 24 hours apart**. Matching URLs are candidates for source linking, not independent corroboration or authority verification. There are 219 case-register rows representing 218 unique case/source pairs and 244 separate case-to-source relationship edges; three-path aggregate from the previously validated provenance review remains 388 distinct case/source catalog pairs. **81/140 published cases** still need complete marked-published metadata in the two direct citation paths; do not equate this with falsity or lack of any evidence.

**Collector health:** Positive News has **35 completed HTTP 403 responses** in the retained 24-hour activity and no HTTP 200; its last recorded success remains November 11. The six other active feeds each have recent successful completions. COVID-19 and Epstein Files Google News each had one 429 in the window but also 34 completed HTTP 200 responses. The Palestine/Gaza feed's latest status was pending at the checkpoint, despite success earlier. No access controls bypassed.

### Primary-source leads newly staged for editorial review (not published)

**FEC OIG Fraud Alert 2027-01 — Impersonation of a Federal Election Commission Procurement Official.**
Agency landing page: https://www.fec.gov/about/reports-about-fec/oig-reports/fec-oig-fraud-alert-impersonation-of-fec-procurement-official/ .
FEC's November 16–20 weekly summary records issuance on **November 20, 2026**: https://www.fec.gov/updates/week-of-november-16-20-2026/ .
The Inspector General warns vendors about a spoofed procurement-official solicitation intended to obtain computer equipment. **Boundaries:** this is an agency fraud alert describing reported attempts and indicators; it is not a judicial finding, a verified victim count or proof that a named individual committed a crime. Suggested queue: public procurement / fraud prevention / source-authenticity checks. Inspect the agency's original PDF before publication; distinguish the example lookalike domain in the alert from legitimate FEC domains.

**DOJ — Senior Leader of Sinaloa Cartel Arrested in Mexico Following Task Force Investigation.**
Original announcement: https://www.justice.gov/usao-sdca/pr/senior-leader-sinaloa-cartel-and-one-fbis-ten-most-wanted-fugitives-arrested-mexico .
**Release dated November 21, 2026; operation described as taking place November 20, 2026.** DOJ states Mexican forces captured Fausto Isidro Meza Flores, a defendant charged in a U.S. superseding indictment, following international coordination. **Boundaries:** arrest and agency-reported operation must be independently corroborated where feasible; allegations in the indictment are not convictions, and the press release is an interested agency account. Do not turn quoted officials' rhetoric into established fact. Suggested queue: justice/accountability / government operations / international enforcement.

Targeted `SELECT`-only searches of news, inbox and sources for each lead's official URL patterns and distinctive identifiers/titles found **zero direct matches**. Related reporting, aliases or mirrored URLs may already exist. Human reviewers should check original documents, case relevance and alternative reporting before creating references; nothing was ingested or published.

### Review-only engineering update

Extended `scripts/audit-news-ingestion.mjs` to emit **capped numeric-ID candidate pairs** for the previously unassessed inbox-to-source exact URL pathway and for news/inbox exact-link **publisher-label differences** and **publication timestamps more than 24 hours apart**. Missing publisher labels and harmless case/spacing variants are not mislabeled as conflicts; malformed URLs are excluded from metadata comparison, and original URLs and unpublished text are never printed. This is triage only: different labels can be legitimate aliases, and divergent timestamps require manual investigation. Four new regression tests added (25 total, awaiting independent CI confirmation at this checkpoint). No automatic linking, deduplication, updates to production records, deploy, or merge.


---

## Follow-up checkpoint — November 23, 2026, 08:24 UTC (00:24 Pacific)

**Read-only production inspection, no writes:** The 985 news records are all pending review; 59 were discovered in the preceding 24 hours and 135 pending entries are over 14 days old. **476** news items have no publication timestamp; **19** of these are not Google-News-associated. The entire 40-item research inbox is pending: 36 older than 14 days, four undated, four lacking watch-topic assignment, and no new inbox items within 24 hours. **123** source records are marked published, **53** without publication dates, one without a URL, and one without a publisher. These fields are metadata, not proof of source veracity.

**Topics, watch timestamps and collector telemetry:** All **36** news topics are active; **11** have no direct news records (IDs 1, 2, 14, 21, 22, 26, 27, 31, 32, 33, 34). All **11** active research-watch and **7** active news-watch timestamp fields are stale/blank; six of seven collectors nevertheless completed successful HTTP 200 polls within the preceding 24 hours. **Positive News** has **38** completed HTTP 403 responses and zero HTTP 200 responses in that period, with its last recorded success on **November 11, 2026**. The **Palestine/Gaza** Google News collector most recently errored with a 429, but had successful collection earlier the same day. COVID-19 and Epstein Files Google News likewise each recorded one transient HTTP 429 alongside 37 HTTP 200 completions. Do not infer total collector downtime from stale watch timestamps, latest error alone, or saved-item counts; do not bypass publisher access controls.

**Duplicates, provenance and correlation:** Read-only exact string comparisons identified **25** news/inbox URL pairs, **5** news/source URL pairs, **0** inbox/source URL pairs, and **no exact within-collection URL duplicate groups**. Of the 25 news/inbox pairs, **five** differ in nonempty publisher labels, and none have publication instants over 24 hours apart. Current three-path case citation counts are **218 distinct register pairs**, **244 graph pairs**, **387 unique direct-path pairs**, and **388 distinct pairs** after claim-linked references are included; this is catalog coverage, **not independent evidence or verification**. **81 of 140** published cases lack a marked-published source with complete publisher/date/HTTP(S)-shaped URL metadata in the two assessed direct paths.

**New review-only opportunity:** On exact, nonblank news-to-source URL matches, **two pairs** have a publication date in only one collection: **(news ID 2, source ID 161)** and **(news ID 5, source ID 160)**. These pairs are triage leads, **not** permission to copy dates between records or infer an article's date from a library entry. Unlike news timestamps, library publication dates have date-only granularity; no naive UTC/local calendar equality test should be applied.

### New original-agency items staged for human editorial review (nothing ingested)

**SEC file S7-2026-40; release 34-106950 — Restructuring the Governance and Funding Model of the Consolidated Audit Trail.** Official proposed-rule page: https://www.sec.gov/rules-regulations/2026/11/s7-2026-40 ; corresponding SEC announcement: https://www.sec.gov/newsroom/press-releases/2026-117-sec-issues-proposal-restructure-consolidated-audit-trail . **Issued November 20, 2026.** The SEC proposes rescinding Rule 613 and adding Rule 17a-26, transferring direct oversight and operation of substantially the same market-data reporting to the Commission or its designee. **Limitations:** this is a **proposal**, not an adopted final rule or proof of improved privacy, cost or enforcement outcomes; the SEC's rationale is its institutional position. Suggested queue: financial-system oversight / public accountability / data privacy. Inspect the actual proposed rule and contrary public comments before treating cost/privacy estimates as settled.

**GAO-27-900726 — Performance and Accountability Report: Fiscal Year 2026.** Official report: https://www.gao.gov/products/gao-27-900726 ; readable report: https://files.gao.gov/reports/GAO-27-900726/index.html . **Published and released November 16, 2026.** GAO reports **$62.5 billion** in FY2026 financial benefits and **1,296** program improvements, with examples involving federal loans and COVID-19 employment tax-credit oversight. **Limitations:** GAO's performance-accountability claims and attributed savings are the agency's reported results, not an independent external replication; do not conflate these benefits with appropriations, available cash, or causally proven counterfactual savings. Suggested queue: documented positive public oversight / government accountability.

Targeted identifier, distinctive-title and official-URL pattern checks against `news_items`, `research_inbox`, and `sources` found **zero direct matches** for these two items; related articles or alternate representations could exist. Before any publication, editors should verify the original rule/report, context, alternatives and case relevance. No database records were added or modified.

### Engineering changes and test boundary

The review-only `scripts/audit-news-ingestion.mjs` now identifies **one-sided date-presence gaps** on syntactically valid exact news/source URL pairs, classifying whether the news or source-library side lacks the value, with sorted capped **numeric-only** review ID pairs. It preserves query-dependent document identity and excludes malformed URL schemes. It deliberately does **not** compare date-only library values to timezone-aware article instants or automatically transfer metadata. Three additional tests cover both missing-side directions, distinct documents, malformed URLs, sorting, output caps and privacy.

**GitHub Actions:** https://github.com/MrMakeItNice/evidence-mapp-app/actions/runs/45138492700 completed successfully on code/test commit `03df1943689c0a7f59c386a5d0cfd3ee32e1b37b`, including Node syntax validation and the focused test suite. Full application/browser testing remains outstanding; this documentation-only commit was not independently CI-tested. **Draft PR #375 remains unmerged**. No production schema/data writes, collector configuration changes, deployments, access-challenge bypasses or automatic publication.


---

## Read-only checkpoint — November 23, 2026, 08:52 UTC (00:52 Pacific)

**Ingestion:** 986/986 news items are pending, 60 discovered in the preceding 24 hours, 135 pending more than 14 days and 476 missing original publication timestamps (457 Google News-associated and 19 other). Research inbox: 40 pending, 36 older than 14 days, 4 undated and 4 unassigned to a research-watch topic. Of 123 sources marked published, 53 lack publication dates, 1 lacks URL and 1 lacks publisher. All 36 news topics are active; 11 have no direct news items (IDs 1, 2, 14, 21, 22, 26, 27, 31, 32, 33, 34). All 11 research-watch and 7 news-watch timestamps remain stale or blank.

**Collection health:** Six of seven feeds have successes within 24 hours. Positive News has **39 completed HTTP 403** responses in the rolling 24-hour activity window and no recorded successful collection after November 11. Three Google News feeds (Palestine/Gaza, COVID-19, Epstein) each experienced one HTTP 429 but also 38 HTTP 200 completions during the examined period. Do not conflate transient rate limits with the persistent Positive News access problem. No collector reconfiguration or bypass attempted.

**Source identity:** Exact raw news↔inbox URL row-pairs: 25; news↔sources: 5; inbox↔sources: 0. No exact within-collection duplicate URL groups. Five news/inbox pairs have different publisher labels. Two news/source pairs have publication-date metadata on only one side: (news #2, source #161) and (news #5, source #160). These are candidates for manual comparison, not provenance verification. No source record was modified.

**Review-only code adjustment:** Before grouping URLs for duplicate detection and cross-collection linking, discard URLs that fail the existing HTTP(S), hostname, credentials or malformed-link checks. Previously the offline audit could count collisions between two identically malformed URLs as valid source matches. Keep malformed link counts and numeric review IDs in the separate quality report, preserve valid query-specific document identities, and do not attempt network access or automatic repair. Two focused regression tests cover malformed cross-collection overlaps and malformed within-collection duplicate counts. No private snapshot content added to the repository.

### Newly staged original-agency leads (editorial review only)

**GAO-27-108433 — Bureau of Indian Affairs: Additional Actions Needed to Address Law Enforcement Staffing Challenges.** Published and publicly released **November 19, 2026**. Official source: https://www.gao.gov/products/gao-27-108433 . GAO reviewed law-enforcement funding, hiring and recruiting challenges on tribal lands and recommended that Interior improve BIA recruitment/retention and seek delegated background-investigation authority. Interior generally concurred. The audit used select site visits and listening sessions that are **not statistically generalizable to every Tribe**. The findings do **not** establish misconduct in every local agency. Candidate topics: Tribal governance, public safety, oversight, historical context.

**SEC press release 2026-115 — fake crypto asset trading platform complaint.** Published **November 19, 2026**. Official source: https://www.sec.gov/newsroom/press-releases/2026-115-sec-eight-entities-used-fake-crypto-asset-trading-platforms-steal-more-37-million-us-investors . The SEC announced civil charges against eight entities and described allegations that false adviser/trading platform representations were used in a scheme involving over $37 million. This release is **the agency's account of allegations in a filed complaint, not a judgment or finding of liability**. A legal-record follow-up should retrieve and compare the complaint, defendants' responses and subsequent court docket before any substantive publication. Candidate topics: investor fraud allegations, regulatory oversight, online deception.

**Duplication check:** Fresh targeted, read-only identifier, official URL pattern and distinctive-title queries found no direct matches for either lead in news items, research inbox or sources. This does not rule out related coverage or near-duplicate titles. Both leads remain staged **only in this memo**, pending primary-document verification and human editorial review.

**Release gate:** Draft PR #375 remains unmerged; code and tests modified only in the PR branch. No database writes/schema migrations, deployment, publication, or collector access workaround. Application/browser end-to-end tests remain outside the focused audit suite.


---

## Read-only checkpoint — November 23, 2026, 09:53 UTC (01:53 Pacific)

**Current ingestion:** 987/987 news items pending review; 58 discovered in the preceding 24h; 135 pending older than 14 days; 476 missing original publication timestamps (457 Google-associated, 19 other). The research inbox has 40 pending, 36 older than 14 days, four without publication timestamps and four without watch-topic assignments; none were newly discovered in 24h. There are 36 active news topics, 11 without direct news records. All 11 active research-watch timestamps and seven active news-watch timestamps are stale/blank. These timestamps do **not** demonstrate that the collectors stopped.

**Collector telemetry:** Six of seven active collectors have successful HTTP 200 completions during the previous 24h (39–40 per feed). Positive News had 40 completed HTTP 403 responses and no recorded success since November 11. Palestine/Gaza, COVID-19 and Epstein Google News each had one HTTP 429 but also 40, 40 and 39 successful completions respectively. No access challenge bypass or collector changes attempted.

**Cross-collection provenance:** Exact URL matches remain at 25 news/inbox, five news/source and zero inbox/source pairs, with zero duplicate exact URL groups inside each collection. Five news/inbox matched pairs have different publisher labels; two news/source pairs have a publication date present on one side only. A review-only direct case-source register join shows all 140 marked-published cases have at least one register citation; **135 of 140 have no directly registered source marked published, dated or publisher-attributed**. A register citation is **not** independent verification of the content or metadata.

**New engineering change (PR branch only):** The offline news-ingestion diagnostic now uses `research_inbox.added_at` as a *fallback only when `discovered_at` is missing* to assess pending-inbox age. It explicitly reports pending IDs with no usable age timestamp and emits capped, numeric-only review IDs. It never uses the cited article's publication time as a proxy for intake or silently classifies unknown ages as fresh. Three new regression tests cover fallback, discovery-time precedence and undatable records; the focused suite now contains 33 tests. In this snapshot, **zero pending inbox records need the fallback** and **zero have neither timestamp**, so the observed 36 aged pending items are unchanged.

### Official research leads staged for human review (not ingested or published)

**GAO-27-108665 — Immigration Detention: ICE Should Determine Cost Effectiveness of New Initiatives Before Continuing.** Original report https://www.gao.gov/products/gao-27-108665 (published and publicly released November 19, 2026). GAO reports ICE acquired 11 warehouses for about $1.07 billion, later planned to sell seven, had not kept the detention spending plan up to date, and had not prepared full life-cycle cost estimates for further detention investments. DHS concurred with two recommendations. **Evidence limitations:** purchase amounts and plan deficiencies are GAO-reviewed findings, while future cost effectiveness and losses are uncertain; the study examined selected sites and costs, not every detention facility. Suggested queue: public spending and detention oversight.

**GAO-27-107934 — Federal Accessibility: Agencies Not Consistently Meeting the Information and Communication Technology Needs of People with Disabilities.** Original report https://www.gao.gov/products/gao-27-107934 (published and publicly released November 19, 2026). GAO found USDA and HUD had gaps in ICT-accessibility predeployment testing; 14 of 23 agencies corrected selected accessibility issues after covert feedback, while nine had not corrected those issues as of May 2026. GAO made two recommendations. **Evidence limitations:** the 23-agency feedback exercise and three selected-agency assessments are not a prevalence estimate for all federal services or evidence every service is inaccessible. Suggested queue: public digital-access accountability and accessibility quality.

**Direct duplication screen:** Identifier, official-URL pattern, and distinctive-title matches for both new GAO leads were **zero** across `news_items`, `research_inbox`, and `sources`. Related coverage under other titles may exist; independent editorial verification is needed. These leads are staged *only in this memo*; no database rows added.

**Verification and release gate:** GitHub Actions `Offline News Ingestion Audit` completed successfully on code/test commit `3128f52eb88994ae734f345b1733f78e37d0a14c`: https://github.com/MrMakeItNice/evidence-mapp-app/actions/runs/45151311781 . This memo update is documentation-only; full app/browser integration testing remains outstanding. Draft PR #375 remains open and unmerged, separately from case-source audit PR #360. No production data/schema changes, deployments, collector reconfigurations or publication.


## Read-only checkpoint — November 23, 2026, 11:17 UTC (03:17 Pacific)

**Scope:** Live read-only aggregates from Supabase `nxlffnplqdobfqxogmxo`; GitHub review branch only, no production schema/data writes, deployment, collector configuration changes, or public research publication.

- **News:** 989/989 pending review, 58 discovered in the preceding 24h, 135 pending for more than 14 days, and 476 missing publication timestamps (19 outside Google News URL domains).
- **Inbox:** 40/40 pending; 36 pending for more than 14 days, four with no watch-topic assignment (IDs 38–41). **Sources:** 53 of 123 marked-published records lack publication dates; one lacks a URL. These are metadata gaps, not proof that documents are invalid.
- **Topic coverage and provenance:** 11 of 36 active news topics have no directly assigned news items. Exact URL joins: 25 news/inbox and 5 news/source; malformed URLs must not be treated as identity matches; zero exact same-collection duplicate groups in the previous comprehensive audit. This checkpoint did not assert independent corroboration from matching URLs.
- **Aged pending news by topic** (live SQL; category names for editorial triage, never source truth grades): topic 28 Palestine / Gaza Updates 20; topic 23 Fact-Checks & Verification 12; topics 12 Investigations & Prosecutions, 13 Civil Rights & Surveillance, and 19 Epidemiology & Public Health 10 each; topic 29 COVID-19 Updates 9. These are *items requiring review*, not event counts or verified claims.
- **Collectors:** Six of seven active collectors have success timestamps within the preceding 24 hours. The Positive News collector logged 41 HTTP 403 completions and zero HTTP 200s in the 24-hour retained log; its last recorded successful completion was November 11, 2026. Three Google News collectors each logged one HTTP 429 but also 40 HTTP 200s. All 11 research-watch and seven news-watch timestamps are stale/blank; collector telemetry and watch metadata should not be conflated. No bypass attempted.
- **Safe code change:** `scripts/audit-news-ingestion.mjs` now ranks aged pending news by numeric topic ID and count, orders ties deterministically, caps output at ten topic counts and reports omitted topics. This improves review assignment without emitting unpublished headlines, URLs, publisher labels, or source text. Two focused regression tests cover ranking, privacy, tie behavior, cap and excluding reviewed news. Never auto-publishes or edits source links.

### Newly staged agency originals — editorial review only

**NARA FY 2026 Agency Financial Report / OIG report 27-AUD-01** — https://www.archives.gov/files/about/plans-reports/agency-financial-reports/nara-fy2026-afr.pdf . **Auditor's report dated November 13, OIG memorandum November 16, 2026.** Independent auditor Sikich gave unmodified opinions on FY2026/2025 financial statements and identified **two significant deficiencies in financial-reporting controls**, but no material weaknesses based on limited procedures and no reportable noncompliance in the provisions tested. NARA separately claims **555 million digitized pages** in its catalog at the end of FY2026; that program-performance claim is **agency-reported, not a figure authenticated by the financial-statement audit**. Relevant to archival access/preservation and public accountability. A significant deficiency is not itself evidence of intentional fraud or missing records.

**SEC Release 34-106946 / FINRA SR-FINRA-2026-027** — https://www.sec.gov/files/rules/sro/finra/2026/34-106946.pdf . **FINRA filed November 18; SEC notice dated November 20, 2026.** Proposed amendment to FINRA Rule 11892 addresses review of clearly erroneous exchange-listed securities transactions as overnight protected price bands are introduced for 23-hour, five-day trading. The filing was designated for immediate effectiveness as a noncontroversial change and the SEC solicits comments; **do not characterize it as an SEC adjudication, evidence of trading misconduct, or a policy effect already measured**. Suggested queue: market transparency / finance regulatory changes.

**Targeted duplication screen:** Read-only searches of `news_items`, `research_inbox`, and `sources` for these two official document URL patterns, distinctive identifiers and title phrases found **no direct matches**. Equivalent coverage under other titles or links may still exist; require manual cross-source checks. Both remain **memo-only**, not database-ingested and not published.
