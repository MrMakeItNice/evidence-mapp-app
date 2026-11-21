# Evidence Atlas research-engineering checkpoint — 2026-11-21 12:13 PST

**Review status: research candidates and offline diagnostics only.** This is a note in a **public draft PR**, not a published Evidence Atlas editorial article. No production Supabase writes/schema changes, publication, collector deployment or merge.

## Read-only audit

Supabase project `nxlffnplqdobfqxogmxo`; database time `2026-11-21T20:13:02Z`.

- 883 news_items, all pending editorial review (+1 versus previous 882 snapshot); 57 discovered within preceding 24 h.
- 414/883 news items lack `published_at`. All 395 Google News proxy-linked rows are missing this date; only 19/488 other rows are missing it. This is **association, not proof of failure location**.
- 36 active news topics, 11 with no news records; 17 `news_articles` remain without article-topic links.
- Research inbox: 40 pending records, 25 exact-URL overlaps with news_items. These can have distinct editorial functions and must not be auto-deduplicated.
- Sources: 285 total; 146 missing publisher; 215 missing publication date; 1 missing URL. 146 distinct sources are represented in the 147-row master source register.
- No exact duplicate URL groups within news_items or sources. A strict normalized long-headline SQL check found **8** collision groups; previous nine-group result used a different normalization policy, so do not interpret the count change as a duplicate being resolved.
- All 11 active research watch timestamps are older than 7 days; all 7 active news watches have no `last_collected_at`.
- Positive News last ran at **12:00 PST**, status error with HTML `Just a moment...` access challenge; last successful recorded run **Nov 11**. Government — BBC saved 1 record in its 12:05 PST run. World News — BBC was pending at 12:10 PST; remaining four feeds showed successful latest polls with zero saved items.

## Engineering improvement (review only)

Added `scripts/audit-feed-date-loss.mjs` and `tests/audit-feed-date-loss.test.mjs` to compare **caller-supplied** RSS/Atom capture metadata and saved news snapshots. The audit reports bounded numeric-ID suggestions **only** when one safe exact URL match exists, database publication date is missing, and the captured entry contains parseable RFC 822/ISO date metadata. Ambiguous URLs, credentials, secret-bearing query keys and malformed dates cannot produce automatic suggestions. No collected timestamps are substituted for publication dates. All results require publisher verification and human review.

Local Node `node --test` run: **6/6 tests passed**, plus an example CLI smoke test. GitHub CI status should be checked separately on PR head after these commits. This diagnostic cannot establish whether the live Google News collector receives a date until an authorized, safe capture snapshot is supplied. Collector code is in `atlas_monitor`, not this PR. Do not bypass the Positive News access challenge.

## Candidate A — GAO pharmacy benefit manager fee disclosure procedural review

- Original primary source: https://www.gao.gov/products/b-338895
- Report B-338895 dated **November 19, 2026**, regarding the DOL/EBSA final rule *Improving Transparency Into Pharmacy Benefit Manager Fee Disclosure*.
- **Attribution:** GAO says EBSA's rule requires compensation disclosures from pharmacy benefit management services and certain affiliates to fiduciaries of large self-insured group plans.
- **Important procedural detail:** GAO determined the stated **January 4, 2027** effective date did **not** satisfy the Congressional Review Act 60-day delay requirement based on the reported November 5 and 6 congressional receipts. This is GAO's procedural assessment, **not** a court invalidation of the rule or proof of misconduct.
- EBSA's regulatory impact estimates in the report are agency projections, **not realized savings**. For a fuller claim, verify the original Federal Register rule and any subsequent official correction to the effective date.
- Database preflight: targeted title/identifier/URL search in news_items, research_inbox and sources found **zero direct matches**. Related health-cost cases and watch topics still require semantic review.
- Editorial classification: official federal rulemaking/oversight. Keep `2026-11-02` (Federal Register rule publication), `2026-11-19` (GAO document date), and `2027-01-04` (stated future effective date) as three **distinct** dates.

## Candidate B — GAO Commerce underutilized federal office space

- Original primary report (HTML): https://files.gao.gov/reports/GAO-27-108813/index.html
- GAO-27-108813 published and released **November 19, 2026**.
- GAO reports about **59% of Commerce's 351 office locations** underutilized relative to the applicable 60% utilization target in an early-2026 measurement window, and **more than $220 million in FY2025 costs** for underused office locations.
- Caveats: 59% describes locations, not floor area or employees. GAO reported some collection-method problems, including survey practices that may overstate occupancy. **Potential** savings of tens of millions from consolidation are not realized savings. Commerce concurred with two recommendations.
- Database preflight: targeted title/GAO number/URL search across news_items, research_inbox and sources returned **zero direct matches**. Check related public spending and official report topics before creating new records.
- Editorial classification: public spending and government accountability, with potential positive impact if follow-up implementation is documented.

## Next human-reviewed steps

1. Verify original issuer page and report chronology for each candidate. Distinguish documented findings from projections, proposed savings and agency statements.
2. Obtain an authorized sanitized capture snapshot from the Google News feed collector and compare RSS `pubDate`/`isoDate` with the saved `published_at` field using the new offline diagnostic. Do not infer that feed timestamps were present based solely on database blanks.
3. Diagnose Positive News via provider-permitted source/feed/API access and sanitized HTTP status; do not attempt to evade access controls.
4. Validate the semantic relationship of new leads to existing records before source linking. Nothing should publish or write automatically.

**No database data/schema changes, no production collector changes, no PR merge, no deployment, and no automatic content publication were performed by this checkpoint.**
