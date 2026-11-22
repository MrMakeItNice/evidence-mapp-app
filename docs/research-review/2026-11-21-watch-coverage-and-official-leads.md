# Evidence Atlas research-engineering review — 2026-11-21, 16:46 Pacific

**Status:** review-only, unpublished. Nothing here authorizes case creation, attribution of wrongdoing, publication, schema changes, collector deployment or automatic source merging.

## Read-only production snapshot

Project: `nxlffnplqdobfqxogmxo`. All values below were checked through SELECT-only queries on 2026-11-21.

- 907 news records, all pending review; 10 discovered in the preceding hour and 49 in the preceding 24 hours.
- 428 / 907 news records lack `published_at`. All 409 Google News proxy URLs have a null publication date (409 of the 428). A pattern is established, **not** its ingestion root cause.
- 36 active news topics, 11 with no news items. No orphan news-topic references detected. All 17 separate `news_articles` lack entries in `news_article_topics`.
- 40 research inbox items pending; 25 inbox records share exact trimmed case-insensitive URLs with news items. Do **not** automatically merge: an inbox item may have a separate editorial purpose.
- 146 / 285 sources lack publisher metadata, 215 / 285 lack publication date, and one source lacks a URL.
- Within news and within sources there were **zero exact repeated URL groups**. Nine long-headline collision groups remain unverified potential duplicates. Five exact URL groups link news items to registered sources.
- 11 / 11 active research watches had last-check timestamps more than seven days old; all seven active news-watch topics lack last-collected timestamps. Positive News latest completed poll at 16:40 Pacific returned an HTML access challenge; last recorded success was November 11. Government — BBC was pending at 16:45; other recently completed feeds included saved items.
- **New coverage finding:** 36 of 40 inbox records link to a research watch; four have no watch assignment. Only eight of 11 active research watches have any linked inbox records. Watches **1 (MKULTRA archival developments), 4 (disputed death investigations), and 8 (Epstein-related court and custody records)** have zero linked inbox items. This is a visibility gap, not evidence that those areas were not researched. Only one inbox record has an explicit related-case link.

## Engineering change in this PR

- `scripts/audit-watch-inbox-coverage.mjs` is an offline diagnostic using caller-supplied `researchWatches` and `researchInbox` arrays. It returns ID-only coverage summaries: no inbox items, only pending items, unassigned items, unknown watch IDs, and links to inactive watches. It does not create relationships or make substantive research inferences.
- `tests/audit-watch-inbox-coverage.test.mjs`: eight local Node 22 tests passed, including input validation, duplicate-ID rejection, immutability and prevention of URL/title/note leakage.
- Existing `.github/workflows/research-review-regression.yml` already watches `scripts/audit-*.mjs` and `tests/*.test.mjs`. Full repository CI status needs independent verification; no claim is made that CI passed.

## Primary-source lead 1 — EPA public hazardous-waste permitting RFI

- **Official source:** EPA, November 20, 2026, https://www.epa.gov/newsreleases/epa-seeks-input-modernizing-hazardous-waste-permitting
- **Process documentation:** https://www.epa.gov/hwpermitting/rcra-hazardous-waste-permitting-public-meetings-and-request-information
- **Docket reference:** EPA-HQ-OLEM-2026-9571.
- **Verified scope of agency statement:** EPA announced an information request and planned public-engagement sessions on RCRA hazardous-waste permitting, including application changes, financial assurance and post-closure responsibilities. EPA lists virtual sessions on December 2, 3, 7 and 10, 2026.
- **Evidence boundary:** This is an agency-proposed review process, **not an enacted rule**, a final administrative finding or proven environmental improvement. The 60-day comment period is measured from Federal Register publication, not automatically from the press-release date.
- **Next editorial checks:** compare with actual Federal Register publication and docket materials; document environmental and state/tribal perspectives; track whether any finalized rule changes follow.

## Primary-source lead 2 — DOJ sentencing and underlying assassination plot

- **Official source:** DOJ Office of Public Affairs, November 20, 2026, https://www.justice.gov/opa/pr/indian-national-sentenced-over-19-years-prison-plotting-assassinate-us-citizen-new-york-city
- **Verified scope of agency statement:** DOJ announced that Nikhil Gupta was sentenced to **235 months** after pleading guilty in February 2026 to murder-for-hire, conspiracy to commit murder-for-hire, and conspiracy to commit money laundering relating to an attempted assassination in New York.
- **Critical separation:** DOJ's statements about the role of co-defendant Vikash Yadav and an Indian government employee are attributed allegations based on charging documents and statements in court. The release explicitly says Yadav was charged but had not been arrested in connection with the charges. Do **not** imply that his guilt or government-wide responsibility has been adjudicated.
- **Next editorial checks:** obtain the sentencing judgment, plea allocution and charging documents, reconcile procedural posture for each person, and invite independent/contextual reporting and competing accounts before any case or article is approved.

**Duplicate screening:** Targeted case, news, source and inbox title/URL searches for both leads returned no direct matches; broader semantic/alias matches may still exist. No Supabase data was inserted.

## Editorial and release safeguards

Both leads remain **candidate sources for human review**, not published Evidence Atlas findings. Confirm underlying documents, dates, quoted figures, entity resolution, alternative explanations and relevance before linking to a verified claim. Preserve Google News proxy provenance rather than silently rewriting publication metadata. This PR remains draft and must not be auto-merged or deployed.
