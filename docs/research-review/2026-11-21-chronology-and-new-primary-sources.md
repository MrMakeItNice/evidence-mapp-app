# Evidence Atlas — chronology validation and primary-source review (2026-11-21 09:01 PST)

**REVIEW ONLY.** This file is an editorial research queue and engineering note; not verified case material, not authority to publish, link records, merge, alter production Supabase, or deploy.

## Read-only pipeline checkpoint (approximately 17:00 UTC on November 21)

- `news_items`: **881 records**, all 881 pending review; **+1** versus the previous report (880). Latest `discovered_at`: **2026-11-21 15:46:00 UTC**.
- **36** active news topics, **11 empty**; no orphan news-to-topic foreign keys. Topic volumes include Palestine/Gaza 157, Epstein 140, COVID-19 139, International Relations 134, Public Spending 118, Public Health 93.
- **40** research-inbox entries, all pending. **25** exact news/inbox URL pairs; do not infer these are accidental duplicates. **4** inbox items lack publication dates.
- News: **413** missing publication dates; **394** links containing Google News domain (proxy count); **zero** missing publisher or URL.
- Sources: **285** total; **146** missing publisher; **215** missing publication date; **one** missing URL.
- No exact repeated URL groups within the news or sources tables. **8** distinct long-headline collision groups (possible edition or syndication overlap, not verified duplicates). Semantic and canonical duplicate audits remain incomplete.
- **11/11** active research watches stale beyond seven days; **7/7** active news watches have never recorded `last_collected_at`.
- The separate `news_articles` collection holds **17** records, with **zero** `news_article_topics` links; it must not be conflated with `news_items`.
- The read-only date chronology check found **zero** publication timestamps more than one day into the future and **zero** items published more than two calendar days after discovery in the news, inbox, and dated sources checked. Missing dates remain the real problem.
- At inspection six collector feed rows showed latest successful runs saving zero records. **Positive News** last failed at **2026-11-21 16:30 UTC (08:30 PST)** with HTTP **403**, returning an HTML access challenge rather than an RSS feed; last successful run **November 11**. A new Epstein collector activity was pending at 17:00 UTC, so the latest outcome was unknown.

## Primary-source candidate A — California wildfire risk mapping (positive, research/tooling)

**NASA Science primary agency release**: https://science.nasa.gov/blogs/science-news/2026/11/18/california-wildfire-risk-3d-maps/

- **Date:** November 18, 2026. NASA describes statewide one-square-meter lidar-derived mapping for California using USGS 3D Elevation Program data. NASA compares the resolution with 10–25-square-meter space-based lidar and describes potential applications to wildfire risk and environmental management.
- **Status:** Agency announcement; maps' technical quality, statewide availability, licensing, and practical effects have **not** been independently evaluated here. Potential risk-reduction benefits are **intended uses**, not observed outcomes.
- **Before editorial acceptance:** inspect the linked lidar dataset and provenance/coverage, check comparison with USGS documentation, establish which derived products actually exist, and request source data or methodology. Consider positive-science coverage if supported.
- Direct URL/title fragment and headline searches across news, inbox, source library and `news_articles` did not return a matching record. This is **not** proof that related wildfire mapping research is absent.

## Primary-source candidate B — federal small business research security reviews

**GAO-27-108923**, published/released **November 19, 2026**: https://www.gao.gov/products/gao-27-108923

- GAO reviewed how five selected agencies performed due diligence for Small Business Innovation Research/Small Business Technology Transfer applicants in FY2024–FY2025. It reports **more than 28,000 proposals reviewed**, **more than 1,700 possible foreign risks**, and **more than 11,000 other risks**.
- **Interpretation guardrail:** “identified possible risks” does **not** mean proven misconduct by applicants, foreign actors, or any named researcher. The five agencies are a selected subset and these counts must not be generalized to all programs.
- **Before editorial acceptance:** inspect the full GAO report methods, definitions and appendices, agency responses, program chronology and links to earlier reports; separate GAO findings from evidence or accusations about individuals.
- Direct identifier, URL and title fragment searches of news, inbox, source library and `news_articles` returned zero matches. Related stories and paraphrased coverage may still exist.

## New review-only engineering

- Added `scripts/audit-date-provenance.mjs` and `tests/audit-date-provenance.test.mjs` on this draft PR branch. The utility accepts a caller-provided JSON snapshot with `newsItems`, `inbox`, `sources` and an explicit `asOf`, then reports only IDs, counts and chronology flags.
- It separates missing/invalid dates, future dates and publications more than two calendar days after discovery, with one-day future-date tolerance. It validates calendar values, rejects invalid or duplicate IDs, and does not print titles, URLs, narratives or raw timestamp strings. **Do not infer missing publication dates**.
- **7/7 local Node v22.16.0 tests passed**; JSON-through-stdin CLI smoke test passed. Not tested against the live collector or deployed backend. Re-run `node --test tests/audit-date-provenance.test.mjs` in review. The live read-only SQL consistency results above are separate from unit tests.
- This is non-integrated offline diagnostic code, not a collector repair. Remaining engineering priorities are resolution of HTML 403 access challenges through permitted official feeds, extracting publisher/source URLs and actual publication dates, correcting watch freshness instrumentation, and review-only source correlation.

**Production controls:** No Supabase schema or data writes, no automatic content publication, no deployment, and no merge. The draft PR remains review-only.
