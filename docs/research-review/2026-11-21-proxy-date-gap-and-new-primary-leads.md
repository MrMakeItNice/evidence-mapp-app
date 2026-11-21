# Evidence Atlas review checkpoint — 2026-11-21, 11:20 PST

**Status:** Investigation candidates and offline code review only. Not approved for publication. No production Supabase updates, schema changes, merges, or deployment.

## Read-only database audit

Project: `nxlffnplqdobfqxogmxo`. Snapshot 2026-11-21T19:20Z.

- 882 news_items, all pending editorial review; 36 active news topics, 11 without news items; no invalid news topic references.
- 414 of 882 news items lack `published_at`. **395/395 Google News proxy URLs lack a date**, compared with **19/487 non-Google URLs**. These are observational correlations, not proof the proxy caused loss; collector field handling needs inspection. The proxy cohort accounts for 395 of 414 missing dates.
- 285 sources: 146 missing publisher, 215 missing publication date, one missing URL. 40 pending research-inbox records; 25 exact inbox/news URL overlaps. Do not automatically merge overlapping editorial records.
- No exact duplicated URL groups within news_items or sources. An independently normalized long-headline SQL audit found **nine** collision groups (18 records); editorial verification is required. A different normalization policy may explain differences from prior runs.
- All 11 active research watches have last-check timestamps older than 7 days (10–19 days old), and all 7 active news watches lack last_collected_at.
- 17 news_articles, zero article-topic links; 4 historical connections. Check collection relationships before suggesting any auto-linking.
- Latest Positive News collector: Nov 21 10:50 PST, HTTP 403 with HTML "Just a moment" access challenge; last success Nov 11. Six other feeds' latest completed polls were HTTP 200 / zero records each; Epstein Files feed was pending at inspection. A successful zero-save poll is not a collection error. Do not assume a remote challenge can be bypassed.
- New script `scripts/audit-proxy-publication-dates.mjs` calculates source-host cohorts and absent publication dates on **caller-provided JSON snapshots** with only aggregate counts and bounded numeric-ID samples; its associated six tests passed locally. No live collector change and no date repair.

## Candidate 1 — GAO oversight of tribal policing staffing

- **Primary URL:** https://www.gao.gov/products/gao-27-108433
- **Report:** GAO-27-108433, *Bureau of Indian Affairs: Additional Actions Needed to Address Law Enforcement Staffing Challenges*.
- **Published/released:** November 19, 2026.
- **Attributed findings:** GAO reports BIA supplies policing directly to about 60 Tribes, faces officer vacancies and extended background-investigation processes, and recommends recruiting/retention measures and exploration of delegated authority for background checks. Department of the Interior **generally concurred** with the two recommendations; the recommendations are currently open.
- **Scope limits:** GAO based its review on policies/data, selected visits and listening sessions; its recommended interventions have not been shown effective or implemented merely by publication of the report.
- **Database preflight:** No direct name/report-number/URL match in news_items, research_inbox or sources (targeted SQL); assess whether existing cases or master source register relate indirectly before ingestion.
- **Editorial task:** Verify full report, jurisdiction, recommendation status and agency response before linking a case or publishing a claim. Record GAO as source of assessment, not a categorical allegation of wrongdoing.

## Candidate 2 — NASA Voyager distance milestone (positive news)

- **Primary URL:** https://www.nasa.gov/news-release/nasas-voyager-1-makes-history-reaching-one-light-day-from-earth/
- **Release:** 26-098, November 19, 2026. **Event:** one light-day distance milestone on **November 18, 2026 at 2:16 a.m. PST**.
- **Attributed finding:** NASA says Voyager 1 reached 25.9 billion kilometers (about 16.1 billion miles) from Earth after 49+ years; its carrier signal and trajectory calculations established the milestone.
- **Material caveat:** NASA says science and engineering data had not been received since November 14, although carrier signals were detected. This should accompany milestone coverage, rather than suggesting uninterrupted scientific telemetry.
- **Database preflight:** No direct title / 'Voyager' / URL match in news_items, research_inbox or sources; other historical NASA/space cases may overlap semantically and should be searched before case creation.
- **Editorial task:** Cross-check event/release dates and NASA/JPL language, preserve mission status caveat, and consider a positive-news research link rather than a new investigation case.

## Next review priorities

1. Identify which Google News RSS metadata timestamp is present at capture and where it is dropped; never replace publication time with `discovered_at`.
2. Investigate the Positive News 403 using permitted feed/API options and clearer challenge classification, not challenge circumvention.
3. Address stale watch status and identify whether timestamps represent unexecuted collection or unsynchronized tracking. Do not backfill fabricated checks.
4. Manually assess headline collisions and source overlap; verify originals and canonical IDs before proposing relationships.

This file is a **staging note in a public draft pull request**, not a published Evidence Atlas story.
