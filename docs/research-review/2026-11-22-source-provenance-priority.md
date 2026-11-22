# Source metadata triage and government document leads — 2026-11-22 UTC

**Evidence Atlas | EDITORIAL REVIEW ONLY.** All database checks were SELECT-only against Supabase project `nxlffnplqdobfqxogmxo`. No evidence has been approved, inserted, published or linked.

## A more useful source-provenance priority breakdown

At approximately 06:37 UTC, `public.sources` had **285 records**, including **123 marked published** and **162 unpublished**. The published flag is an application state, **not independent proof that a source or claim is correct**.

| Metadata issue | Published subset (123) | Unpublished subset (162) | Total |
| --- | ---: | ---: | ---: |
| Publisher blank | 1 | 145 | 146 |
| Publication date missing | 53 | 162 | 215 |
| Source URL blank | 1 | 0 | 1 |

**144** records are unpublished `master_index_bibliography` placeholders; all 144 lack publisher and date. Thus blanket statements like “146 sources missing publishers” overstate the *published* source-audit priority. **Published source ID 285** has no publisher, publication date or URL, and a separate complete nine-family linkage audit found no structured reference to it. This is a **review flag, not deletion authorization**: free-text use may exist.

The proposed offline tool requires an explicitly complete local snapshot, returns aggregate counts for unpublished records and IDs only for published records with gaps, and never echoes titles, publishers, URLs or notes. It does **not** infer dates, change data or treat unpublished bibliographic placeholders as fully verified records. Cross-check all metadata against original primary documents before making any manual edit.

## Ingestion, watches and duplicate review

- News: **924 pending**; **441 missing original publication dates**, including **422 Google News proxies** and 19 non-Google links; 54 discovered during the previous 24 hours, two during the previous hour.
- Research inbox: **40 pending**, four without assigned watch topics; **25 exact URL overlaps** with news, which are correlations, not proven duplicates.
- No exact trimmed-case-insensitive duplicate URL groups were found *within* the news or source tables. Three news/topic group-slug differences have a populated item slug but NULL topic slug; these may be intentional labels.
- News topics: **36 active**, including **11 empty**; the prior topic/feed audit showed the empty topics lack assigned active collectors. Research watches: **11/11** older than seven days; news watches: **7/7** without collection timestamps.
- Positive News's latest completed collector run returned **HTTP 403**, last recorded successful collection November 11. The retained query showed 35 recorded error rows in 24 hours, **not** a necessarily complete count of actual attempts. The six remaining collector feeds had recent successful completions (Government–BBC's latest dispatch was pending at the moment checked).

## Recently released primary sources staged for independent review

### DOJ: Palisades Fire jury verdict — November 20, 2026
Official release: https://www.justice.gov/usao-cdca/pr/former-la-resident-found-guilty-federal-charges-deliberately-starting-what-became

DOJ reports a federal jury found Jonathan Rinderknecht guilty of two fire-related charges on November 20. This is a **conviction, not a sentencing** (DOJ schedules sentencing for March 17, 2027); separate DOJ descriptions of fire progression and loss are attributed to trial evidence rather than independent verification here. A BBC news report about the same verdict is **already in the pending news queue (news ID 21488)**. Link/compare before considering a separate source record; do not create duplicate case files.

### EPA/Army/HHS: Iowa Army Ammunition Plant statement — November 20, 2026
Official release: https://www.epa.gov/newsreleases/update-iowa-army-ammunition-plant-middletown-iowa

A joint agency statement outlines planned precautions for a controlled detonation. It **does not establish measured exposure levels or independently prove zero risk**; obtain monitoring results and local records before making health or environmental claims. Targeted title/identifier checks found no direct existing source, news, inbox or case match.

### EPA: Portland, Tennessee wastewater proposed settlement — November 20, 2026
Official notice: https://www.epa.gov/publicnotices/consent-agreement-and-final-order-city-portland-alleged-clean-water-act-violations

EPA Region 4 proposes a **$30,000** administrative penalty under docket **CWA-04-2026-1002(b)** involving **alleged** Clean Water Act violations. The notice is a **proposal**, not proof of final adjudication. Search by docket ID when reviewing updated status. Targeted term/identifier checks found no direct existing source, news, inbox or case match.

## Editorial safeguards and next steps

Verify document dates, canonical identity, procedural status, alternative explanations, and any later corrections before writing claims. Link any approved primary material to existing related records only after checking for semantic duplicates. Triage the 53 date gaps among published records before trying to backfill dates in unpublished bibliographies. Restore the Positive News collector only through authorized access or an approved alternative; do not bypass access controls.

This PR adds offline diagnosis and tests only; **no production database schema/data changes, merges, deployments, or automatic publication**.
