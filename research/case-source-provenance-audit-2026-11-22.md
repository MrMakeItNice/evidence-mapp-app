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


## Follow-up: 2026-11-22 20:10 UTC / 12:10 Pacific — source *kind* versus documentary verification

### New source-kind gap discovered by read-only join

An examination of the **219 case-to-master-register citation links** found:
- **219/219** links carry `source_role=cited_by_master_index`. A reference in the master index is *not* a separate fact-check, independent witness or guarantee the underlying original was reviewed.
- **213/219** links target sources labeled `source_type=master_index_bibliography`; **5** link to a `Congressional Hearing` source type and **1** to an `official investigation announcement` type.
- **134 of the 140 published cases** have *only* master-index bibliography-type linked references; **6** published cases have at least one linked source with a different source type. The latter records are **not automatically verified** merely because their source type differs.
- Case **26**, source **26**, repeats through register IDs **32** and **46**. Both are in register `cases_1_100`, use distinct reference codes `S32` and `S46`, and both indicate original PDF page **11**. This is a catalog-level review lead, not proof of redundant original evidence or an instruction to delete either citation.

A bibliography pointer may identify an authentic released government document. Source type is an *editorial classification*, not a conclusion about truth or source availability. Prioritize opening the original primary document, confirming the page/record context, publisher/date, and linking it with an explicitly attributed source role. Do not infer that 134 cases have zero primary evidence.

The offline diagnostic in this draft PR now counts references of the `master_index_bibliography` type and published cases whose linked references are *exclusively* that type; it adds a separate review reason, `only_master_index_bibliography_sources`, and counts `cited_by_master_index` roles. Counts are by catalog *links*, not unique independent sources. The source-type field is validated as an optional string; unrecognized or missing types are **not** classified as bibliography merely by assumption. Five new focused regression tests check mixed types, bibliography-only cases, missing links, and invalid types.

### Latest ingestion/collector inventory (read-only, 20:10 UTC)

- `news_items`: **940 pending**, **57 discovered in previous 24 hours**, **447 lacking publication dates**, including **428 Google News proxy-URL items**; **135 pending beyond 14 days**.
- `research_inbox`: **40 pending**, four undated and four without a watch assignment. The published-marked library sources remain **123**, of which **53** lack publication dates.
- Exact URL joins: **25** news/inbox and **5** news/source links. No within-table exact URL duplicate groups in news, inbox or sources. Exact URLs are possible record links, not independent corroboration.
- **11/36** active news topics have no news items; **11/11** active research watch timestamps and **7/7** active news-watch timestamps are older than 24 hours or blank. Stale watch timestamps do not alone mean polling has stopped.
- `Positive News`: **41 observed completed HTTP 403** responses in the retained 24-hour activity; last recorded success **November 11**. The current feed status is error with a challenge-page response. No anti-bot bypass attempted.
- `COVID-19 — Google News`: one observed HTTP 429 in 24 hours but **later HTTP 200**; do not describe it as an ongoing outage. Government BBC, World BBC, Gaza Google News, COVID Google News and Epstein Google News latest completed checks were successful. Public Health BBC had a **pending** run at the observation instant, after earlier successes.
- These activity counts describe the retained observed rows, **not** total attempt counts or availability guarantees.

### Two additional original-agency review leads (not published)

**Federal Election Commission Office of Inspector General — Fraud Alert 2027-01**, issued **November 20, 2026**. Original OIG alert listed by Oversight.gov: https://www.oversight.gov/reports/fec-oig-fraud-alert-2027-01 . Original FEC document linked by the listing: https://www.fec.gov/resources/cms-content/documents/Fraud-Alert-Nov-2026.pdf . The FEC OIG reports a malicious impersonation attempt targeting vendors by falsely posing as the FEC procurement director to obtain equipment. This is an official *fraud alert*, **not** an adjudication of identity, losses, or convictions. Review the original attachment, scope and updates before any claim about an identified perpetrator. Candidate connection: government official impersonation, contractor fraud prevention.

**GAO-27-108433 — Bureau of Indian Affairs: Additional Actions Needed to Address Law Enforcement Staffing Challenges**, published and released **November 19, 2026**. Original agency page: https://www.gao.gov/products/gao-27-108433 . GAO found high law-enforcement vacancy rates and problems recruiting and retaining officers at BIA; its page records **two open recommendations**. This is a staffing/capacity finding, not evidence of deliberate denial of policing to Tribes. Compare the methodology, agency response and later implementation. Candidate cross-link: tribal public safety and previously published GAO workforce-capacity oversight; these are related reports, **not independent confirmations of every claim**.

Targeted identifier/title/URL-phrase searches of `news_items`, `research_inbox` and `sources` yielded **zero direct matches** for either new lead. This does not rule out indirect mentions, related existing cases, variants or other editorial staging memos. Both leads remain in **this PR memo only** for editorial review; no database insertion, publication or automatic case creation.

**Release boundary:** source-type classification is a catalog-triage measure, not a validity verdict. No production DB writes, schema changes, merges, deployments, web fetches against source URLs, collector changes or automatic publication. CI checks are focused only.


## Follow-up: November 22, 2026, 21:09 UTC / 1:09 PM Pacific — citation *role* independence check

### Read-only database audit
- All **140 published cases** have case-register citations; all **219/219** links have `source_role=cited_by_master_index` (zero missing role values). Thus **140/140 published cases have exclusively master-index citation roles**. This is a catalog-linking convention, **not** evidence that the referenced documents are invalid or that each underlying primary document has/has not been reviewed independently.
- **134/140** published cases additionally have only `source_type=master_index_bibliography` linked records. The remaining six do not automatically constitute verified investigations: a source type and a citation role answer *different* questions.
- **219 register links / 218 distinct case-source relationships**, with one repeated pair requiring catalog-level review. No edits or deletions were made.
- **940/940 news items pending**; 57 discovered in 24h; **447** without publication timestamps, including **428** Google News proxy records; **135** pending more than 14 days.
- Research inbox: **40 pending**, four undated, four unassigned. Published-flagged library sources: **123**, of which **53** undated. URL joins: **25** news-inbox, **5** news-sources; no exact within-table URL duplicate groups. **11/36** active news topics have no news; **11/11** research and **7/7** news watch timestamps stale/empty. The latter do not by themselves prove stopped collection.
- Seven enabled feed summaries: six report recent successful completions; Positive News last successful November 11 and most recent run shown as pending. Retained preceding-24-hour activity has **41 completed HTTP 403** observations for Positive News; COVID Google News has one 429 incident followed by successful completion. A pending observation is not itself a completed failure.

### Two new official research leads (editorial only)

**GAO-27-107934 — Federal Accessibility: Agencies Not Consistently Meeting the Information and Communication Technology Needs of People with Disabilities.** Official source: https://www.gao.gov/products/gao-27-107934 ; **published/released November 19, 2026**. GAO reports that **14 of 23** agencies fixed the website accessibility issues GAO covertly reported between September 2025 and February 2026, while **nine had not fixed them as of May 2026**. GAO found USDA and HUD had gaps in pre-deployment accessibility testing; two recommendations remain marked open. This is a documented sample and follow-up cutoff, **not proof that nine agencies deliberately discriminated or have not remediated since May**. Cross-link only after review to access to public information, web accessibility and oversight; cite GAO methodology, agency responses and status dates.

**Department of Education OIG — Fiscal Year 2027 Annual Plan.** Official oversight catalog: https://www.oversight.gov/reports/other/fiscal-year-2027-annual-plan ; **issued November 20, 2026**. The OIG describes proposed priorities and resources for evaluating Department of Education program integrity in FY2027. This is a **work plan, not a completed investigation or finding of misconduct**; retrieve and review the complete plan and any final engagement reports separately. Cross-link to transparency/education oversight only if a specific initiative relates to existing research.

Targeted source identifiers, exact URL fragments, and title-phrase searches in `news_items`, `research_inbox` and `sources` returned **zero direct matches** for either lead. This does not establish absence from related cases, unindexed records, alternate URL versions, prior memos or external collections. Both leads are staged in this review-only markdown; they have **not** been inserted into production or published.

### Engineering change and verification

The local offline provenance diagnostic now tracks **citation role** separately from source type: counts explicit role omissions, counts published cases whose *every* citation has the master-index role and flags their numeric IDs for review. Unknown/missing roles are **not** silently classified as index-only, and a different explicit role does **not** prove independent corroboration. Malformed non-string role fields cause snapshot rejection. Four regression tests cover index-only roles attached to official-type source records, mixed roles, unknown roles and malformed roles.

The PR-specific **Offline Case Source Coverage** GitHub Actions run **#45070578792** passed after the code/test commit (30 focused Node tests and syntax checks expected from the existing 26 plus four new tests). The documentation update follows that run. Full application/browser checks remain outstanding.

**Safety:** no production Supabase writes/schema changes, no collector configuration changes, no automatic source status changes, no publication, no merge and no deployment. No unpublished database snapshots or source excerpts were committed.


## Follow-up: November 22, 2026, 22:22 UTC / 2:22 PM Pacific — published-library linkage audit

### Novel read-only finding: source-library publication is not case citation coverage

Fresh SELECT-only queries returned **285 source-library records**, including **123 marked published**. Only **one** published-marked source is referenced by the case→master-register relationship; **122 published-marked sources are outside that particular join**, **53 of those 122 lack a publication date**. Of the **146 distinct sources** referenced by the case register, **145 are not marked published** and the one published-marked source is the Senate MKULTRA hearing. The other 122 records are *not* necessarily unused: research entries, other application paths or direct narrative references may use them. They should **not** be automatically linked to cases on keyword similarity, nor classified as invalid or orphaned.

The offline audit now reports source-library visibility independently from case-register links, counts undated published-marked records outside that join, and exposes at most 25 **numeric IDs** for human review. It does not output titles/URLs/notes, attempt automatic correlations, or change database records. Three focused regression tests cover an outside-register source, a draft-case register link, and an output cap.

### Ingestion and health observations

At the 22:22 UTC query: **940/940 news pending**, **55** newly discovered in the preceding 24 hours, **447** undated (of which **428** have Google News proxy URLs), and **135** pending over 14 days. The research inbox remains **40 pending**, with **four** undated and **four** without watch assignments. There are **53 undated records among 123 published-marked library sources**. Exactly **25 news↔inbox** and **5 news↔sources** URL matches; **zero** exact duplicate URL groups within news, inbox or sources. URL overlap is a cross-record candidate, not independent corroboration. **11/36 active news topics** have no news records; **11/11 research** and **7/7 news watch** timestamp fields are stale or blank (not proof polling stopped).

The collector telemetry has **288 observed requested runs** in the retained preceding-24-hour window, including **41 completed HTTP 403** responses and **one completed HTTP 429**. The seven enabled feed summaries show six recent successful completions. **Positive News** reports an access-challenge error and last successful collection **November 11**; do not bypass its access controls. COVID-19 Google News's latest summary is successful after an earlier 429.

### Original-agency sources staged for editorial review, not published

**Denali Commission OIG — FY2026 Financial Statement Audit, report 2027-AUD-05**, **issued November 20, 2026**. Original oversight listing: https://www.oversight.gov/reports/audit/results-audit-fy-2026-denali-commission-financial-statement-audit-report-no-2027-aud . According to the OIG's report listing, the independent auditor expressed an **unmodified opinion** that the commission's FY2026 and FY2025 financial statements present fairly, in all material respects, the described financial position under applicable accounting standards. This is useful *positive oversight evidence* and a counterweight to treating every audit as evidence of wrongdoing. **Do not** infer that all internal controls are effective or that the absence of questioned costs establishes zero risk. The listing is an official agency/OIG description; review full report scope, management findings, and auditor qualifications before publication. No direct title or report-code match found in the three target research collections.

**U.S. Justice and Commerce Departments — Megaspeed joint statement**, **November 17, 2026**, updated November 18. Official statement: https://www.justice.gov/opa/pr/joint-statement-department-commerce-and-department-justice-megaspeed-investigation . DOJ and Commerce state that the Department of Commerce began a 2024 semiconductor-export investigation, sought Nvidia records in May 2025, and conducted a June 2025 end-use check in Singapore with local law enforcement. These are **attributed agency descriptions** of an ongoing investigation; do not treat them as court findings or as independent verification of every event alleged. The database search returned **two topic-related BBC news items**, IDs **6948** and **10871**, with distinct BBC URLs, but **no exact official-statement URL or title-phrase record** in news, inbox or sources. A reviewer could connect the new primary statement as a separately attributed official-source node to those two news articles without merging or asserting independent corroboration. Verify subsequent legal/court records before changing finding status.

**Editorial state:** both sources remain in this draft PR memo for review; nothing was inserted into production. Exact-URL and title/identifier checks are limited to the three queried collections and do not prove that related documents or reports are absent elsewhere.

**Safety and verification boundary:** no production schema/data writes, source status changes, case/source link creation, collector configuration changes, publication, merge or deploy. PR-scoped tests cover only the offline diagnostic; full application/browser readiness requires separate verification.


## Follow-up: November 22, 2026, 22:43 UTC / 2:43 PM Pacific — **critical graph-linkage clarification**

### Why the register-only result must NOT be interpreted as overall source coverage

An expanded, SELECT-only audit found **a second, populated case→source relationship path** in `public.relationships`. This materially qualifies the earlier focus on the master-register join:

- The master case-register contains **219 citation rows** representing **218 distinct case/source pairs**, and covers all **140 published cases**. **Five** published cases have a linked source with publication date, publisher, valid-looking HTTP(S) URL and published flag on that same record **in this particular register path**.
- Separately, `relationships` contains **244 case→source edges** across **140 distinct case IDs** and **188 distinct source IDs**. All 244 have existing case IDs and source targets; for every row, `target_id = source_id_reference`. The relationship type is `Annotated research reference`. These entries are **not verified independent evidence merely because they are in a graph**.
- **75** underlying case/source pairs occur in both paths. The combined *unique* case/source catalog relationships total **387** (218 + 244 − 75), not 462 independent corroborations.
- **59 of 140 published cases** have at least one graph-linked source whose **same record** has a publication date, nonblank publisher, published flag and syntactically HTTP(S)-shaped URL. The combined graph-or-register figure is **59**, leaving **81 without a same-record complete *marked-published* citation on either checked path**. Metadata completeness is *not* original-document review or a claim-veracity verdict. This count uses a SQL URL syntax screen, not a network resolution or editorial review.
- Of **122 published-marked sources outside the case-register join**, **120 are referenced by the relationship graph**, **one more by `claim_sources`**, and **one by neither of those paths nor the other checked structured source paths** (`source.id=285`, which lacks publisher, source type and publication date). Consequently, **do not call the 122 sources orphans or automatically attach them to cases**. This supersedes any interpretation of earlier register-only statistics as whole-platform coverage.
- The current `relationships` table's `source_type='case'` and `target_type='source'` labels refer to endpoint entity types; its `source_id_reference` is the supporting source ID. This dual use of the word "source" makes schema-aware joins essential.

### Engineering scope

The offline `audit-case-source-coverage.mjs` now accepts an **optional complete** `relationships` snapshot and matching expected count. If it is absent, `relationship_graph` is **null**, not an inferred zero. It rejects truncated graph snapshots, resolves case→source endpoint IDs against the included complete case/source tables, counts graph-register overlap and duplicate pair rows, and reports combined published-source metadata coverage only as distinct *cases*. It counts target/source-reference ID disagreement without attempting a repair. Five new regression tests cover completeness, privacy, overlap and cross-path discovery. **No snapshot is committed.** Published-marked citation metadata is not evidence of factual accuracy.

### Fresh ingestion and collector checks

`news_items`: **940 pending**, **55** discovered in the preceding 24 hours, **447** missing publication timestamps (including **428** Google News proxy URLs), **135** pending longer than 14 days. `research_inbox`: **40 pending**, four undated and four without watch assignment; its latest discovery timestamp is November 10. `sources`: **123** published-marked, **53** without dates and **one** without publisher. **11 of 36** active news topics have no news items. All **11 research-watch last_checked_at** fields are dated November 11 or earlier; all seven news-watch last_collected_at fields are null. These timestamp gaps do not prove ingestion is stopped.

Seven enabled collector summaries show six recent HTTP 200 completions (latest checks November 22). **Positive News** still returns a challenge page/HTTP 403 (41 completed 403 observations in the retained prior-24-hour activity); last successful collection remains November 11. **COVID-19 Google News** had one 429 observation followed by successful HTTP 200 polls. No access control or rate-limit bypass was attempted.

### New original-agency research leads — editorial staging only

**GAO-27-109349 — FEMA Assistance for People with Disabilities (Easy Read supplement)**: https://www.gao.gov/products/gao-27-109349 . **Published/publicly released November 19, 2026.** This is an *accessible-format supplement* to GAO-27-108057, **not an independent investigation**. GAO says FEMA ended a training program for state/community disability preparedness in 2025, some specialist roles were unclear, and some forms were difficult to understand; it made three recommendations in the underlying report. Review the underlying full report and agency response before correlating with disability access and disaster aid. Do not double-count supplement and original as independent corroborations.

**GAO-27-108087 — Tribal Justice: Congressional Action Needed to Support Tribal Sovereignty**: https://www.gao.gov/products/gao-27-108087 . **Published/publicly released November 16, 2026.** GAO found limits under Public Law 280 on Tribes initiating jurisdictional retrocession and consent, and reported funding differences in specified historical years. Two congressional matters for consideration are listed open. Carefully distinguish legal analysis, Tribal/state perspectives and selected funding data from any inference of intentional harm. Related to, but distinct from, the GAO BIA staffing report already staged.

Targeted ID/title/URL queries in `news_items`, `research_inbox`, and `sources` found **no direct matches** to these two identifiers/titles. This does not rule out variants, linked topics, previous memos or other sources. Both leads are **staged here in the review-only memo**, not inserted into production or published.

**Safety:** no database writes/schema changes, credential exposure, source-status changes, PR merges, deployment or automatic publication. Focused tests and workflow status must be checked on the new head commit before calling the update verified.


## Follow-up: November 23, 2026, 00:18 UTC / November 22, 4:18 PM Pacific — claim-mediated citation pathway

### New cross-path finding: 388 distinct *catalog pairs*, not 388 verified citations

Fresh **SELECT-only** joins found **seven `claim_sources` edges for five claim records**, representing only **two distinct case/source pairs**, both associated with the same published case. One pair is already present in the master register; **one** pair (`case_id=1, source_id=2`) is absent from both assessed case-register and case→source graph links. Thus **218 distinct register pairs + 244 graph pairs − 75 overlaps = 387; adding one previously unrepresented claim-mediated pair gives 388** distinct case/source *relationships* across three paths. These are **catalog relationships, not independently corroborated findings**. Claim evidence may support, refute or contextualize a proposition and cannot be promoted automatically to case-level proof.

The count of published cases with at least one complete marked-published **direct register or graph** source remains **59/140**; the remaining **81/140** still require metadata review under that specific definition. Claim-mediated sources must be assessed in their claim context, not pooled with direct citations to inflate primary-document coverage.

### Engineering change in this draft PR

The offline diagnostic accepts `claims` and `claim_sources` together as an **optional third, complete-snapshot pathway**. If neither snapshot is supplied, `claim_evidence` is null; if either table or expected count is missing/truncated, the audit fails rather than inventing zero links. It verifies case/source references, rejects repeated claim/source composite keys, handles claims without an assigned case, counts overlaps with register and optional graph pathways, and emits only capped **numeric case/source IDs** for newly represented indirect pairs. It never exports claim text, page references, URL contents or unpublished notes. Five new focused regression tests cover completeness, overlap, privacy and bad links. This is an offline tool with **no network/database client, no production writes, and no automatic relationship creation**.

### Current live ingestion and collector inventory (00:18 UTC)

| Read-only check | Observed |
|---|---:|
| News items awaiting review | 952/952 |
| News discovered in preceding 24 hours | 52 |
| News without publication timestamps | 453 |
| Google News proxy items among undated records | 434 |
| Pending news older than 14 days | 135 |
| Research inbox pending | 40/40 |
| Inbox items undated / without watch assignment | 4 / 4 |
| Source library marked published | 123 |
| Published-marked library sources undated | 53 |
| Exact news↔research-inbox URL overlaps | 25 |
| Exact news↔source-library URL overlaps | 5 |
| Exact URL duplicates within each of three collections | 0 groups |
| Active news topics with zero news records | 11/36 |
| Research watches with stale/blank `last_checked_at` | 11/11 |
| News watches with stale/blank `last_collected_at` | 7/7 |

Watch timestamp fields alone are not reliable proof of collection cessation. Of seven active feed summaries, six have recent successful completions. **Positive News** remains blocked by an HTTP 403 challenge, with **41 completed 403 observations in the retained preceding 24-hour activity** and no recorded success since November 11. **COVID-19 Google News** has a rate-limit 429 observation followed by successful polling. Public Health BBC had a pending run at the snapshot instant, not an established failure. Do not bypass source access restrictions.

### Two original-agency documents for editor review — **not** publication

**GAO-27-108656 — Critical Infrastructure Protection: Food and Agriculture Sector Cybersecurity**, **published and publicly released November 19, 2026**. Official full report (accessible HTML): https://files.gao.gov/reports/GAO-27-108656/index.html . GAO assessed USDA/FDA actions against 16 requirements across six statutory categories. Its audit says five requirements were partially met or unmet; resource and staffing constraints were reported. It made five recommendations overall (three to HHS and two to USDA); HHS concurred and USDA disagreed with its two. The report recounts voluntary industry incident data and interviews with a small nonrepresentative set of organizations; **incident tallies are not a complete census and do not establish intentional sabotage**. Editorial relevance: food-system resilience, cybersecurity, public-risk accountability. Independently verify any incident-level claim against the cited underlying records.

**DOJ — Nikhil Gupta sentencing statement**, **November 20, 2026**. Official DOJ announcement: https://www.justice.gov/opa/pr/indian-national-sentenced-over-19-years-prison-plotting-assassinate-us-citizen-new-york-city . DOJ says Gupta was sentenced to **235 months** after a **February 2026 guilty plea** to murder-for-hire-related and money-laundering conspiracy charges. The sentencing/plea is materially different from allegations about additional individuals or an entire government: **attribute the claimed direction by an Indian government employee to DOJ/court filings, and do not treat unadjudicated co-defendant allegations as convictions**. Editorial relevance: transnational state-linked violence investigations and evidentiary distinctions between pleas, court findings, and allegations. Consult court docket and response from relevant parties before publishing a developed case.

A targeted database search for the above report ID, core title phrases and official URL fragments in `news_items`, `research_inbox` and `sources` returned **no direct matches**. This does not prove absence in other structures, alternative URLs, or earlier editorial notes. Both are staged in **this PR memo only**; nothing has been published or inserted into production.

**Boundary:** no Supabase changes of any kind, merges, deploys, collector changes, publication-status updates or automated research publication. Run the new focused test workflow and independently review findings before marking the PR ready.
