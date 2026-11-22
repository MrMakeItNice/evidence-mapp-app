# Evidence Atlas research review — 2026-11-22 (UTC)

**Status: research candidates only. No automatic ingestion, editorial approval, case creation, or publication.** This memo records a read-only inspection and original government reporting. Do not move it into live content without independent editorial review.

## Read-only pipeline snapshot

Queried Supabase project nxlffnplqdobfqxogmxo at approximately 2026-11-22 07:52 UTC (2026-11-21 evening Pacific).

- News items: **925 total, all 925 pending review**. 55 discovered in the preceding 24 hours. **441 missing original publication timestamps**, including 422 Google News proxy URLs. Discovery timestamps must not be substituted for source publication dates.
- Research inbox: **40 pending**; 4 lack a watch-topic assignment.
- Active news topics: **11/36 without items**, previously found to lack assigned active collector feeds; not proof of collector failure.
- **25 exact source_url matches** between the news and research-inbox tables. Of those pairs, **21 have differing normalized titles/headlines** and **5 have differing normalized publishers**, but **0 have differing stored publication timestamps**, review status or assessment. Variants are not necessarily errors. News topic IDs and research watch IDs belong to separate namespaces and must not be compared.
- Sources: 285; 123 marked published. Of published sources, 53 lack publication dates and one (ID 285) lacks publisher and URL. An existing separate draft already covers that issue. Do not infer dates.
- All 11 research watch timestamps stale by seven-day threshold; all seven news watch collection timestamps unset.
- Positive News last completed collector attempt returned HTTP 403; last recorded success was November 11. A bounded 24-hour query returned **37 completed HTTP 403 errors**. Retention does not establish complete failure history. Six other collectors last completed successfully.
- Within-table exact source URL duplicates are prevented by unique constraints; cross-table matching does not establish duplicate investigations or interchangeable records.

## Engineering proposal in this PR

The offline script accepts locally exported **complete** news/inbox snapshots with explicit expected row counts. It matches exact URLs and outputs **only numeric record IDs and boolean discrepancy flags**, not source URLs, titles, notes, publishers or raw dates. It does not normalize tracking parameters or infer common ownership. It never changes publication or review state, never contacts Supabase, and never proposes automatic merging. Inputs remain local and must not be committed.

An operator may use the diagnostic to **prioritize human reconciliation** of the 25 shared URLs, preserving two distinct editorial records until reviewed. Any later integration must compare IDs against a fresh read-only export and treat changed sources as unverified.

## New primary-source candidates, not yet in production

1. **GAO-27-107854 — Military Education Benefits**. Published and publicly released **November 20, 2026**. GAO found Air Force and Navy orientation requirements did not align with DOD's existing tuition-assistance information policy. Two recommendations listed as **open**, with DOD agreement. Do not conclude service members never receive information through other channels.
   - Original: https://www.gao.gov/products/gao-27-107854
   - Review action: verify full report, responses and relevant coverage; consider education/oversight topic rather than a new scandal case.

2. **GAO-27-108923 — Small Business Research Programs**. Published and publicly released **November 19, 2026**. GAO examined due-diligence tracking in five selected agencies for fiscal years 2024–2025, citing more than 28,000 assessed proposals and more than 1,700 **possible** foreign risks. A risk flag is not proof of espionage or wrongdoing.
   - Original: https://www.gao.gov/products/gao-27-108923
   - Review action: assess methodology and scope; avoid casting assessed applicants as culpable.

3. **GAO-27-108433 — Bureau of Indian Affairs Law Enforcement Staffing**. Published and publicly released **November 19, 2026**. GAO described vacancies, recruitment limitations, and a lengthy background-investigation process, with **two open** recommendations. Findings cover BIA staffing and selected tribal-land investigations, not every Indigenous jurisdiction.
   - Original: https://www.gao.gov/products/gao-27-108433
   - Review action: check agency responses and any affected community viewpoints before possible framing.

Targeted SQL checks of source titles/URLs, inbox titles/URLs and news headlines/URLs using report identifiers GAO-27-107854, GAO-27-108923, GAO-27-108433 found **zero direct identifier matches** at audit time. This does not prove there is no related coverage under another title or URL. No documents, case links or public content were inserted.

## Release gates

Focused regression tests; complete-export guard; privacy of numeric-only diagnostic output; human review of source content and context; independent CI status check before merge. No schema/data writes, site deployment, PR merge or research publication in this run.
