# Evidence Atlas — source/news relationships and new DOJ FOIA release

**Review-only checkpoint: November 21, 2026, ~15:10 PST.** Production was inspected with read-only SQL. This note is staged in a public draft PR, not an editorial publication or authorization to insert data.

## Pipeline snapshot
- 888 news items, all pending editorial review; +3 versus preceding 885-record audit. 415 lack \`published_at\`. All 396 Google News proxy entries lack publication dates; 19 other news records also lack them. This concentration does **not** prove root cause.
- 36 active news topics, 11 without items. 40 research-inbox entries pending, with 25 exact inbox/news URL overlaps. Eleven active research watches have checks older than 24 hours; all seven news-watch topics have null \`last_collected_at\`. Collector runs are a separate signal.
- 285 source records: 146 lack publisher, 215 lack publication date, one lacks URL. Eight repeated long-headline groups are potential duplicates, not confirmed. No exact repeated-URL groups within news or sources.
- Seventeen news articles still lack article-topic links.

## New structural provenance result
Five exact trimmed-URL matches exist between \`sources.url\` and \`news_items.source_url\`:

| Source ID | News ID | Publisher stored on both sides | Publication-date evidence |
| --- | --- | --- | --- |
| 153 | 4 | International Criminal Court | Both missing; live court docket |
| 155 | 3 | International Court of Justice | Both missing; live court docket |
| 156 | 1 | U.S. Department of Justice | Both missing; consolidated library |
| 160 | 5 | World Health Organization | Source missing; news 2025-06-27 |
| 161 | 2 | World Health Organization | Source missing; news 2025-06-27 |

All five source entries are \`published=false\`, and all five news entries are pending. These are possible source/news relationships, **not** independent corroboration, proof of the same document edition, or permission to auto-link. No exact source/inbox URL overlap exists in this snapshot. Two WHO source dates must not be backfilled from news without verifying the official originals.

New \`scripts/audit-source-news-links.mjs\` accepts offline source and news JSON arrays, identifies exact one-to-one URL pairs, flags missing/conflicting publisher/date metadata, and emits only numeric IDs and comparison categories. It rejects unsafe URL credentials and known secret-bearing query parameters, retains functional document IDs and fragments, rejects ambiguous automatic pairings, and performs **no** database or network I/O. Eight local Node tests and a CLI smoke test passed; review and CI remain outstanding.

## Primary-document lead — DOJ FOIA, posted November 20, 2026
- Official OIP index: https://www.justice.gov/oip/available-documents-oip
- 31-page interim PDF: https://www.justice.gov/oip/media/1473571/dl?inline=
- Separate final-package link (not inspected): https://www.justice.gov/oip/media/1473586/dl?inline=

The U.S. Department of Justice Office of Information Policy lists **Records Concerning Executive Orders 14281 and 14260**, posted **Nov. 20, 2026**, with an interim record range **April 23–August 7, 2025** and a final-package range **April 23–June 28, 2025**. The **release posting date is not the date of the underlying records**.

The 31-page interim PDF was inspected, including screenshots of physical pages 1 and 5. Page 1 contains an **April 23, 2025 draft email** about EO 14260 and the requested 60-day report. Page 5 contains a **May 24, 2025 email** transmitting a draft of DOJ ENRD's report and describing proposed recommendations on state and local energy regulation. Other correspondence records editing and review. Evidence of drafting and transmitting a report **does not prove final adoption of any recommendation, actual enforcement activity, unlawfulness of a state law, or observed impact**. Some details are redacted and email attachments may not be part of the PDF. The final-package PDF could not be fetched for inspection because of a large-file error; do not claim it was read. The inspected interim PDF did not return a text match for “14281,” despite the index labeling both orders.

Targeted Supabase searches found no direct title/order-number or PDF-ID match in sources, news or research inbox. Older DOJ FOIA research appears under other links, so broader topical duplication remains possible. Stage this as an **editorial research candidate only**, not an approved case or news item.

**Editorial next steps:** retrieve the complete final release through a supported source, preserve document date, release posting date, covered-record interval, and interim/final status in separate fields, check original orders and agency follow-up, and compare competing legal interpretations. Do not conflate a draft recommendation with enacted policy or legal judgment.

## Other watch source
The GAO's live COVID-19 recommendations page reports **95 open recommendations, 8 priority**, **as of November 21, 2026**: https://www.gao.gov/coronavirus/coronavirus-recommendations . These are agency index counts, not proof of compliance or resolution; preserve dated snapshots and verify individual recommendations.

## Collector health
At inspection: Positive News last run **2026-11-21 22:55 UTC / 14:55 PST** returned HTML access challenge; last success November 11. World News — BBC saved three records in latest completed run. Five other completed feeds reported zero saved, and Public Health — BBC remained pending. Do not bypass access controls; pursue a sanctioned endpoint and proper feed metadata capture.

**No Supabase writes, schema changes, automated links, publication, PR merge, or deployment.**