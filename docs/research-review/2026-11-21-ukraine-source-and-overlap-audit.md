# Evidence Atlas — cross-collection provenance and UNICEF Ukraine candidate (2026-11-21 07:36 PST)

**REVIEW ONLY — not approved for editorial publication, automated import, case creation, or database modification.** Database results are from read-only Supabase queries; public-source statements remain attributed to their issuers. Do not treat cross-collection URL overlap as factual corroboration.

## Pipeline observation (approximately 15:35–15:36 UTC, November 21)

- **880** `news_items` rows, **all pending review**; latest `discovered_at` 2026-11-21T15:01:00Z. This is **+1** over the previous recorded audit of 879. **36** active topics; **11** contain no `news_items`. There are **zero unknown topic references** in news_items.
- **40** research-inbox rows, all pending, with **25 exact URL overlaps** against `news_items`. Of those 25 overlapping pairs, only **4 titles match exactly** and **21 titles differ**; **24 have matching stored timestamps**, while one date comparison is unavailable. An editorially rewritten inbox title is not necessarily a duplicate mistake.
- Research inbox missing metadata: **0** without URL, **0** without publisher, **4** without publication timestamp. This does not establish source verification or ingest correctness.
- News source gaps: **412** records without `published_at`; **393** with `news.google.com` URLs. Source library: **146/285** missing publisher, **215/285** missing publication date, **1** missing URL.
- No exact duplicate non-null URL groups were found **within** news_items or **within** sources. Separate long headline collision analysis still returns **8 groups**; canonical or semantic duplicate classification remains undone.
- **11** active research watches have last-check timestamps no later than November 11; **7** active news watches have NULL `last_collected_at`. Do not overwrite freshness timestamps just to remove this warning.
- Collector status: Positive News failed at **2026-11-21T15:20:00Z** with an HTML challenge, last success **2026-11-11T16:46:00Z**; the deployed collector remains unfixed. At inspection five other feeds were marked successful with zero saved records (COVID-19, Epstein Files, Government/BBC, Palestine/Gaza, World News/BBC). Public Health/BBC was **pending** at 15:35Z; its outcome cannot yet be classified. 
- Parallel news_articles graph: **17** articles, **0** article-topic links, **4** historical links. Keep distinct from news_items, whose topic IDs all exist.

## New primary-source candidate — UNICEF Ukraine, November 20, 2026

- **Official release:** https://www.unicef.org/ukraine/en/press-releases/child-casualties-ukraine-reach-highest-level-almost-four-years-unicef
- **Issuer:** UNICEF Ukraine; **date published:** 2026-11-20.
- UNICEF attributes to the UN Human Rights Monitoring Mission in Ukraine a count of **at least 1,144 verified child casualties** in Ukraine during **January–October 2026**, consisting of **114 killed** and **1,030 injured**. These figures must be attributed as reported; they are not separately corroborated by this audit.
- Other figures in the UNICEF announcement include **146 child casualties in October** and a reported worsening of attacks on energy infrastructure. This is an agency publication, not an independent scientific measurement by Evidence Atlas.
- Direct title-fragment and URL searches in `news_items`, `research_inbox`, `sources`, and `news_articles` returned **no matching record**. That does not establish absence of paraphrased, syndicated, or related coverage.
- **Editorial steps:** retrieve the underlying HRMMU verification methodology/data, check reporting cutoffs and revisions, distinguish verified from reported incidents, preserve humanitarian context, and check for related existing Ukraine stories before any new record or public claim.
- **Proposed topic for consideration only:** Conflict & Civilian Protection (topic ID 10) or Humanitarian Crises (topic ID 9). Do not attach a topic automatically.

## New engineering — advisory inbox/news URL matching

- Added `scripts/audit-inbox-news-overlaps.mjs` and `tests/audit-inbox-news-overlaps.test.mjs`, both offline. The CLI accepts a local JSON snapshot `{ "inbox": [...], "newsItems": [...] }` and outputs only record IDs, pair-level title/date comparison booleans, and counts.
- Uses **identical trimmed URLs only**. Does not strip query parameters, document IDs, fragments, or tracking values. Excludes credential-bearing or invalid URL values; does not print URLs, titles, token values, summaries, or source text. Repeated matching news URLs are flagged as ambiguous, not automatically linked.
- **Eight of eight targeted Node unit tests passed locally**, and a small stdin-to-CLI smoke test passed. This tests the isolated script, not the deployed collector or Supabase integration.
- Reviewer: re-run `node --test tests/audit-inbox-news-overlaps.test.mjs`, inspect privacy properties, and only use a sanitized read-only data export to check the 25 exact overlaps. Keep both records until a human validates their distinct roles.

**Production safeguards:** No data/schema changes, deployment, merge, automatic publishing, editorial approval, or live collector repair are part of this update. 
