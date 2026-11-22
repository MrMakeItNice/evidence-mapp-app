# Source reference coverage and primary-source leads
Evidence Atlas research review — 2026-11-21, approximately 20:14 PST.
Status: Draft, unapproved, no Supabase writes or automatic publication.

## Read-only source-provenance correction
A narrow query considering only master_source_register, claim_sources and investigation_group_sources falsely suggested 121 of 285 sources lacked structured citations. This is **not** the correct orphan count: the relationships and investigation-group events tables also link to sources.

Across all **nine** source-referencing families, **284 of 285** library sources have at least one structured reference. Source **ID 285** is the only record without a link in those nine tables; it is marked published. It may be cited in case text, so do not delete it or treat it as unsupported. Distinct source counts by family: master register 146, relationships 188, investigation-group sources 18, investigation-group events 7, claims 2. Counts overlap.

This PR adds an offline audit requiring **all nine** reference families in its input. The script outputs IDs only, flags references to unknown source IDs and refuses partial snapshots. It cannot establish citation accuracy, source content quality or approval for publication.

## Pipeline snapshot
- 922 pending news items; 440 missing dates, including all 421 Google News proxy records. No exact repeated URLs within news or sources.
- 36 active topics; 11 lack news records. 40 pending inbox items, 25 exact URL overlaps with news, four without watch assignments.
- All 11 research watches are stale; all 7 active news watches lack collection timestamps. All 17 rows in news_articles lack topic links.
- Of 285 sources, 146 have missing publisher fields and 215 lack publication dates.
- Three news items (IDs 4, 5, 85) have a group slug when the related topic has a null group slug; these could be intentional cross-topic labels.
- Positive News returned HTTP 403 in 42 of 42 completed runs during the preceding 24h, with last success November 11; six other collectors last completed successfully (HTTP 200), each saving zero. Do not bypass upstream access controls.

## New public primary-source candidates (all unapproved)
Targeted exact URL checks across news_items, sources, research_inbox and short-title matches in news_items/sources found **zero direct matches** for these three candidates. This is not exhaustive duplicate clearance.

1. **NARA / OGIS FOIA Advisory Committee**, publication date November 20, 2026: https://foia.blogs.archives.gov/2026/11/20/join-us-in-december-for-two-foia-advisory-committee-meetings/ . Meetings are **scheduled** for December 3 and 10, with public comment. No policy change or meeting outcome has yet occurred. Track official agendas and minutes later.

2. **EPA Region 4: proposed Sevierville Clean Water Act settlement**, published November 20, 2026: https://www.epa.gov/publicnotices/consent-agreement-and-final-order-city-sevierville-tennessee-alleged-clean-water-act . EPA proposes a **$53,600** administrative penalty related to alleged wastewater permit TN0063959 violations, docket EPA-R04-CWA-2026-1007(b). **Proposal and allegations only**, not an adjudicated finding or final paid penalty.

3. **EPA / Feeding South Florida food recovery**, published November 20, 2026: https://www.epa.gov/newsreleases/through-epas-feed-it-onward-initiative-administrator-zeldin-highlights-south-florida . EPA reports 600+ participating retail locations for the food bank and 105 Feed It Onward programme partner organizations through 25 engagements since 2025. **Agency/partner accounts**, not independent verification of recovered tonnage or causal results. Positive-news candidate requiring corroboration.

## Editorial and engineering review
Verify each canonical record, date, version and attribution. Separate future plans from outcomes, accusations from legal findings, and self-reported impacts from audited outcomes. Deduplicate by official docket/document IDs only after checking exact versions. No Supabase writes, schema changes, publication, merge or deployment.

Offline usage: supply JSON with sources records and a references object containing **all nine** source-bearing arrays using the field names declared in SOURCE_REFERENCE_FIELDS; run node scripts/review-source-reference-coverage.mjs local-snapshot.json. Keep raw exports private; share the ID-only output for review.