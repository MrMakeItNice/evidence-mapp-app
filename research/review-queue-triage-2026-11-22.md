# Evidence Atlas research & triage review — 2026-11-22 UTC

**Status: editorial staging only.** This file is not a publication queue insertion and is not evidence of a verified allegation. No Supabase writes, case edits, merges or deployments are proposed.

## Fresh read-only database inspection

Project: `nxlffnplqdobfqxogmxo`. Figures reflect queries made around 08:36 UTC, Nov 22, 2026:

- 926 `news_items`, all pending review; 54 discovered in the previous 24 hours and 134 pending more than 14 days.
- 441 have no publication timestamp; 422 of those use a Google News proxy URL. **Do not fill publication time from discovery time or the proxy address.**
- 53 items are tagged `primary_document`; 4 lack publication timestamps. Another 2 undated items are tagged `legal_record`. Review IDs: news #1, #3, #4, #82, #85, #358. Tags are not a verification of source type or truth.
- 40 research-inbox items, all pending; 4 unassigned to a research watch. 3 of 11 research watches have no inbox records. All 11 research watches have stale `last_checked_at` values, and all 7 news watch topics have null `last_collected_at`.
- 25 exact URL matches between news and inbox, 5 exact URL matches between news and sources. Neither implies independent corroboration.
- Zero repeated URL groups *within* the news or source tables. Eleven of 36 active news topics are empty.
- 285 source records; 123 marked published. 53 published sources lack a publication date. Source #285 is marked published but has no publisher, publication date, source URL, archive URL, or source type; inspect before assigning any credibility or changing status.
- Positive News collector's last recorded success remains Nov 11. Retained monitoring data includes 38 completed HTTP 403 failures for this feed in the queried previous-24-hour window; do not equate a truncated window with the full failure history. Six other feeds had recent successful completions; a Palestine/Gaza dispatch was pending at inspection.

### Review-queue engineering proposal

`scripts/triage-review-queue.mjs` accepts **complete offline local** snapshots with explicitly supplied counts and observation time. It creates a capped, deterministic list of numeric IDs and reasons, ranked for manual attention: missing dates on user-tagged primary/legal records, exact cross-library links, cross-queue overlap, unassigned inbox items, proxy links with missing dates, and aging. A rank is *editorial workload priority*, **not** evidence credibility or veracity. No URLs, titles, content, source text, or personal data are emitted.

Run `node --check scripts/triage-review-queue.mjs` and `node --test tests/triage-review-queue.test.mjs`. Confirm the focused PR GitHub Actions result before review. The tool does not access Supabase, perform collection, link entities, assign source ratings, or publish claims. **Do not commit real snapshots**.

## Newly reviewed primary-source leads (not published)

1. **FTC complaint update, Nov 20, 2026.** The FTC announced that 10 additional states joined its Dollar General deceptive-pricing lawsuit, raising participating states to 30. Source: https://www.ftc.gov/news-events/news/press-releases/2026/11/ten-additional-states-join-ftc-lawsuit-alleging-dollar-general-charged-consumers-more-advertised . This documents a filed *allegation* and amendment, **not a judicial finding**. For confirmation, inspect the amended complaint and docket, then seek any responsive court filings. Targeted title/URL queries across `news_items`, `research_inbox` and `sources` found zero direct matches.
2. **GAO-27-900726, Nov 16, 2026.** GAO's FY2026 Performance and Accountability Report states it achieved **$62.5 billion in financial benefits** and describes agency work and measurement methods. Primary public record: https://www.gao.gov/products/gao-27-900726 . This is an attributed GAO accounting/impact claim, not an independently demonstrated cash saving of that exact amount. Verify definitions and methods in the full report before presenting as a finding. Targeted identifier/title searches across all three collections found zero direct matches.

## Editorial verification tasks

- Read original FTC amended complaint (and latest docket dispositions) before deciding whether a case is warranted. Maintain allegation / response / adjudication separation.
- Review GAO methodology and prior annual reports for comparability before reporting a trend or effect.
- Triage undated primary/legal records and cross-queue matches first; preserve missing dates as unknown.
- Investigate Positive News HTTP 403 via the provider's allowed RSS/API or access agreement, never bypass an access challenge.
- Keep all evidence and link suggestions in draft PR review until a human verifies source identity, claim scope and duplicate lineage.

## Follow-up read-only check — Nov 22, 2026, 09:36 UTC

- Database now has **928 pending news items** (up from 926 at prior checkpoint), including 54 newly discovered during the preceding 24 hours. **441** still lack publication times (422 Google News proxies); **134** pending items have discovery timestamps older than 14 days.
- The research inbox still has 40 pending entries. **Four inbox records (#26, #32, #37, #41) have no publication date.** The initial triage utility did not assign a specific missing-date reason to inbox records; follow-up code adds `inbox_missing_date`, validates supplied inbox timestamps and never substitutes discovery time for publication time. Tests include null dates, malformed date rejection and reviewed-record exclusion.
- **25** exact news/inbox URL pairs remain review candidates. **11/11** active research-watch timestamps are stale; **7/7** active news-watch topics lack last collection timestamps. **11/36** active news topics have no items. **53/123** sources marked published lack a publication date. Zero exact repeated-URL groups were detected within news or sources. Source #285 still has incomplete publication metadata.
- The Positive News collector still reports an error (latest success Nov 11); six other feeds have recent successful completions. A failed collector poll is not a claim about a news item.

### Additional government-origin leads (editorial review only)

1. **GAO-27-109349 (Nov 19)**: easy-read supplemental version of GAO's FEMA disability-disaster-assistance report, https://www.gao.gov/products/gao-27-109349 . GAO reports barriers in disaster-assistance applications and three recommendations. Treat this as an **accessible derivative of a parent report**, not an independent corroborating investigation or separate case. Review linked parent report GAO-27-108057 for substantive methods and agency responses.
2. **DOJ Western District of Pennsylvania (Nov 20)**: https://www.justice.gov/usao-wdpa/pr/monaca-resident-charged-money-laundering-and-wire-fraud-relation-international-ghost . The release announces an indictment concerning alleged participation in an international federal-student-aid fraud scheme. DOJ's earlier Oct 29 nationwide Operation Ghostbusters release (https://www.justice.gov/opa/pr/justice-department-unveils-indictments-nationwide-ghost-student-fraud-scam-linked-kenyan) is a **potential parent investigation connection**, not independent evidence of the new charges. Indictments are allegations; defendants are presumed innocent.

Targeted read-only checks of news, inbox, sources and case titles found no direct headline/title/URL matches for the two new leads. They are not published or linked. Preserve parent/derivative relationships during human review and obtain full underlying GAO report and filed charging documents before publication.


## 10:33 UTC evidence-first checkpoint — 22 November 2026

**Read-only aggregate query, not a publication or verified case finding.** Supabase project `nxlffnplqdobfqxogmxo` remains unchanged.

- News: **930** records, all pending; **53** discovered in the prior 24 hours; **134** pending with discovery timestamps older than 14 days. **441** are missing publication timestamps, including **422** Google News proxy URLs.
- Research inbox: **40** pending; **36** discovered more than 14 days ago, **4** without published dates and **4** without watch assignments. **3/11** active research watches have no assigned inbox items; **11/11** show stale check times.
- Sources: **285**, of which **123** marked published; **53** of those lack dates, **1** lacks a URL. Source **#285** still lacks publisher, publication date and URL. Preserve unknowns.
- Correlation: **25** exact news/inbox URL pairs and **5** news/source pairs; **zero** repeated exact-URL groups within news or sources. Matches are potential cross-links, *not* independent corroboration or permission to merge.
- Coverage: **11/36** active news topics have zero news items; **7/7** active news watches have null collection timestamps, and **17/17** news articles have no structured news-article topic association.
- Collector: **Positive News** last succeeded November 11 and has **41 observed HTTP 403 responses** among completed polls requested in the preceding 24-hour query. The activity retention window varies by feed; the number is not a complete historical failure count. Six other collector feeds have recently succeeded; the Epstein feed's latest dispatch was pending at inspection. Do not bypass publisher access restrictions.

### Code review: invalid-date normalization blocked

`Date.parse('2026-02-30T12:00:00Z')` normalizes the impossible February 30 date into March 2 in Node; this can mis-order reviews while appearing syntactically valid. Updated the offline triage utility to validate actual month/day/leap-year, hour and UTC offset bounds *before* Date.parse. Regression coverage includes leap day, Feb 30, Nov 31, invalid local hours and impossible timezone offsets. This only affects review ordering of **local snapshots**, not production record dates. Full app validation is not implied by focused regression checks.

### Newly staged official-source leads — editor verification required

1. **NARA Presidential Library Explorer (November 2026 snapshot; month, not a specific publication day).** https://www.archives.gov/findingaid/presidential-library-explorer and detailed list https://www.archives.gov/findingaid/presidential-library-explorer/list. The overview reports **3,035,617 online scans**, **609,626,325 estimated textual pages** and **5.228%** online. The direct ratio of those two headline counts is about **0.498%**, not 5.228%; the detailed per-library figures also do not obviously reconcile to the overview. **Do not repeat the advertised percentage as a verified global digitization share.** Check the underlying NARA Catalog API counts, the data definitions, and the date/version of both pages, and request NARA clarification if unresolved. This is a **data-methodology discrepancy**, *not* evidence of withheld or destroyed documents. Exact title/URL search in sources, news and inbox found no direct match.
2. **DOJ indictment announcement, Nov 20, 2026:** https://www.justice.gov/opa/pr/law-firm-owner-indicted-willful-failure-file-tax-returns. The Justice Department says a Colorado law-firm owner was indicted for alleged willful failure to file individual and corporate tax returns for 2020–2025. **An indictment is an allegation; no conviction is established here.** Assess whether it adds value to Evidence Atlas before opening a case; the full indictment and any response/court docket should be examined. Targeted title/URL searches in news, inbox and sources found zero direct matches.

Both leads remain in this **review memo only**. No source import, case creation, automatic linking, production schema/data modification, publication, merge or deployment.


## 12:17 UTC evidence-first checkpoint — 22 November 2026

**Read-only database inspection:** 931 `news_items` (all pending; +1 since prior check); 53 discovered within 24h, 134 pending more than 14 days, 441 missing publication timestamps (422 Google News proxy URLs). Research inbox: 40 pending, 4 missing publication dates, 4 without watch assignments. Active news topics: 36, with 11 empty. Research watch topics: 11/11 stale; news watch topics: 7/7 with null collection timestamps. Sources: 285 total, 123 flagged published, 53 of published records without publication dates, 1 published record without URL or publisher. Source #285 still needs manual provenance review. No automatic date inference or status changes.

**Correlations:** 25 exact news/inbox URL matches; 5 exact news/source URL matches; no repeated exact-URL groups within the news or source tables. Importantly, **all five matched source records (#153, #155, #156, #160, #161) are flagged `published=false`** and have null publication dates. They are primary-reference placeholders/links, not five published independent sources. Code and regression tests now distinguish `shared_source_record_url` (published flag true) from `shared_unpublished_source_url` (published flag false or unknown). Both are review-only URL matches, not corroboration or a recommendation to publish. This change never modifies the source registry.

**Collectors:** Positive News had 41 observed completed HTTP 403 polls in the preceding 24h query, with last recorded success on Nov 11. The activity-history retention window does not prove this is the full 24-hour failure total. Five other feeds showed completed successful last runs, with Epstein Files dispatch pending at snapshot; that collector's previous recorded run succeeded. Fix upstream access only using an authorized API/RSS interface, not an access-control workaround.

### New government-origin leads — review only

1. **DOJ, November 20, 2026: Nikhil Gupta sentenced** (https://www.justice.gov/opa/pr/indian-national-sentenced-over-19-years-prison-plotting-assassinate-us-citizen-new-york-city). DOJ reports Gupta received a 235-month sentence following his February 2026 guilty plea involving an attempted murder-for-hire plot against a U.S.-based Sikh separatist activist. The sentence and plea are distinct from allegations concerning co-defendant Vikash Yadav and the role of the Indian government, which require court-record review and any official responses before attribution. Reconcile underlying plea, sentencing docket and charging documents; do not infer culpability for unconvicted persons.
2. **DOJ, November 19, 2026: Haiti assassination case verdict** (https://www.justice.gov/opa/pr/federal-jury-convicts-fifth-defendant-scheme-assassinate-haitian-president-jovenel-moise). DOJ reports a federal jury convicted Christian Emmanuel Sanon on several counts in a case concerning the July 2021 assassination of Haitian President Jovenel Moïse. Sentencing remains pending; other defendants' charged conduct must be distinguished from proven convictions. The DOJ states Sanon falsely claimed U.S. State Department backing; do **not** transform that into evidence that the State Department sponsored the plot. For original filings and verdict details, review case 22-cr-20104 (Southern District of Florida).

Targeted case-title, news-headline/URL, inbox-title/URL and source-title/URL searches found no direct matches for these leads. These checks are scoped and do not prove the subject has no prior mention elsewhere. Both remain **unpublished editorial candidates**: do not create cases, merge unrelated investigations or insert records automatically.

**Engineering verification:** Run `node --test tests/triage-review-queue.test.mjs` and review focused GitHub Actions on the latest commit. Tests explicitly cover published, unpublished, unknown and mixed-status source URL matches. Source publication flags describe database editorial status, **not the factual accuracy or evidentiary weight** of a document.

**Safety:** No Supabase writes/DDL, source metadata modifications, merges, deployments or automatic publication.
