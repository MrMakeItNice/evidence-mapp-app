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
