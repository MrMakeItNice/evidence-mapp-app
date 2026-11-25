# Evidence Atlas evidence-linkage audit and primary-source leads — 2026-11-21 ~13:09 PST

**Status: editorial/engineering review only.** Public draft PR material is not an approved Evidence Atlas publication. No production data/schema edits, deployments, merges or automatic publication.

## Read-only production audit

Supabase project `nxlffnplqdobfqxogmxo`. At inspection:

- News: **883** records, all pending; **414** lack publication timestamps. **395/395 Google News proxy URL rows** lack `published_at`. This correlation suggests prioritizing feed-to-database metadata mapping, but does not prove the failure mechanism. **36** active news topics, **11** with no news items.
- Watchlist: all **11** research watch-topic check timestamps are over seven days old, and all **7** news-watch collection timestamps are null. Feed-level status is tracked separately; null watch timestamps do not establish all feeds stopped.
- Research inbox **40 pending**, including **25** URL overlaps with news. Do not auto-merge: same URL can serve different editorial purposes.
- Source library: **285** records; **146** lack publisher metadata, **215** publication dates, **1** URL. Exact duplicate-URL groups: **zero** within sources and within news. Strict long-headline collision query: **9 groups**, unresolved.
- Topic graph: **17** news_article records with **0** article-topic links (separate from news_items topic relationships).

**New case-evidence coverage finding:** There are **143 cases**, of which **140** have at least one `case_source_references` link through `master_source_register`. The three lacking registered links are unpublished cases: ID **143** (`[QA ONLY] Import and edit acceptance test`), ID **144** (`Epstein list`) and ID **145** (`911`). The database contains **5 structured `claims`** associated with only one case; **142 of 143 cases** have no structured claim row. All five structured claims have at least one `claim_sources` link; **219** case/register links exist, none pointing at a null or missing source. All **244** generic relationships have a source reference. This is a *structured coverage/ingestion issue*, NOT a finding that the remaining cases lack evidence, nor a justification to populate claims automatically. Historical material may be stored in case text and register references.

**Collector:** Positive News's latest finished run began **12:35 PST**, returned **HTTP 403** and an HTML `Just a moment...` access challenge. Its latest attempt at **13:10 PST** was still pending at inspection, and last recorded success remains **November 11**. All six other feeds' latest completed runs returned HTTP 200, status ok, **0** saved. Do not evade provider access challenges.

## Engineering implementation in this draft PR

`scripts/audit-case-evidence-coverage.mjs` and `tests/audit-case-evidence-coverage.test.mjs`: offline structural integrity review of case → register → source and claim → source links. Detect missing join coverage, orphan foreign IDs and repeated pairs using only supplied local JSON snapshots. Reject malformed/duplicate IDs; emit numeric ID-only reports; do not expose titles/URLs, imply fact verification, connect to Supabase, or create evidence links. Seven focused Node tests passed locally, including privacy and immutable input checks; CLI smoke test passed. Full repository CI is not established. Not run on a complete exported production snapshot.

## Newly checked primary-source leads

### A. FEMA accessibility supplemental (new format of existing report)

- Primary issuer: U.S. GAO, **GAO-27-109349**, published **November 19, 2026**: https://www.gao.gov/products/gao-27-109349
- This is an **Easy Read supplement** of GAO-27-108057, *Disaster Assistance: FEMA Actions Needed to Better Support People with Disabilities in Disasters*, not a second independent investigation. GAO describes FEMA's discontinued disability-related training, unclear specialist responsibilities, and application accessibility concerns; report lists **3 recommendations**. Verify the parent report and agency response when drafting a case.
- Targeted URL/title searches of news_items, inbox, sources and news_articles found **no direct match**. Editorial decision: link as supplementary version to the parent report, not a duplicate stand-alone case.

### B. NASA small-business R&D funding (positive development)

- Original NASA article, published **November 20, 2026**: https://www.nasa.gov/directorates/rtmd/new-nasa-seed-funding-primes-small-businesses-for-innovation/
- NASA states that the SBIR/STTR program selected **302 projects** for a **potential total investment up to $171 million**, including battery, robotic, solar and lunar landing infrastructure research. These are selections / funding ceilings and prospective capabilities, **not demonstrated mission outcomes or spent funds**.
- Targeted URL/title searches of news_items, inbox, sources and news_articles found **no direct match**. Human check of NASA's linked Phase I/II selection lists, award dates and actual obligations is required prior to publishing.

## Next review steps

1. Decide whether the 142 cases lacking *structured* claim rows represent intentionally unstructured archives or an ingestion priority; do not synthesize claims or blanket-classify cases as unsupported.
2. Inspect the three unlinked **unpublished** cases, especially the QA fixture, without automatically publishing or deleting any record.
3. Diagnose the Google News timestamp gap with permitted sanitized RSS captures and `audit-feed-date-loss.mjs`; never substitute discovery time as publisher time.
4. Assess source leads against parent documents, variants and existing case relationships, then stage evidence-backed linking suggestions for human review.

**No production schema/data modification, deployment, merge or automatic publication.**
