# Evidence Atlas — source provenance & collection freshness (2026-11-21 05:23 PST)

**DRAFT FOR HUMAN EDITORIAL/ENGINEERING REVIEW ONLY.** Public repository note; not approved for ingestion, publication, source linking, live collector changes, database changes or deployment.

## 1. Existing COVID-19 news item: source-enrichment candidate

- Database news_items.id=19437, topic 29 (COVID-19 Updates), pending review, published_at=NULL, discovered Nov 21, 2026 10:31 UTC.
- Stored Google News headline: "Building infrastructure and evidence for COVID-19 related research, using integrated data from NCHS Data Linkage Program - HHS.gov". Source is a Google News proxy; no original publisher URL is stored.
- Potential primary HHS/ASPE **report**: https://aspe.hhs.gov/reports/nchs-synthetic-dataset-linkage-project ; HHS/ASPE search-indexed report dated **July 6, 2026**. The report describes NCHS synthetic linked datasets, including an NHIS–CMS–HUD linkage and an NHCS–National Death Index linkage, with privacy-protective methods.
- Separate, similarly titled **project overview**: https://aspe.hhs.gov/building-infrastructure-evidence-covid-19-related-research . This is a project description, not necessarily the same published report or page. No publication date established for the overview.
- **Critical provenance distinction:** the July 6 report date must *not* be automatically copied onto news item #19437 without resolving the underlying Google News destination and comparing original titles/versions. The direct HHS report page returned HTTP 403 to an independent web fetch; search-indexed official report metadata is available but is not a fully inspected body.
- Targeted read-only SQL searches found one existing matching news item (#19437), no matching research inbox or source-library entry by title/report URL. This is **not a new COVID case**.
- Editorial next step: verify the Google News target against both official ASPE pages, confirm publication metadata, retain original Google News link for provenance, and only then propose a canonical source association.

## 2. Newly published humanitarian positive-action/needs candidate

- **World Food Programme (WFP), Global Outlook 2027** dated **November 20, 2026**.
- Primary WFP press release: https://www.wfp.org/news/world-food-programme-sets-out-2027-plan-assist-91-million-people-need-food-crisis-looms
- Primary WFP publication landing page: https://www.wfp.org/publications/wfp-global-outlook
- WFP says it **plans** assistance for **91 million** people in 2027, requiring **US$12.1 billion**, while citing **266 million** people facing acute hunger as a distinct needs estimate (referenced in the 2025 GRFC). Do not conflate planned assistance with total worldwide need or independently verified outcomes.
- This is a WFP operational/funding outlook, not evidence that planned support has been delivered, and it is not specifically a Gaza report. Contextualize funding uncertainty and agency-reporting limitations.
- Targeted SQL title/URL searches found no direct match in news items, research inbox, sources, or news_articles. Exact matching cannot exclude semantic or archived duplicates. Candidate for a human-reviewed humanitarian-solutions/positive-news assessment, **not automatic publication**.
- Human review: verify full report methodology and numerical timeframes; seek competing assessments before any claim grading. Preserve publisher attribution.

## 3. Read-only operational snapshot at Nov 21 13:23 UTC (05:23 PST)

- **878 news items**, all in pending review, **+1** from the preceding 877-item audit; newest recorded discovery **Nov 21 12:16 UTC** (COVID-19 / Retraction Watch via Google News).
- **412** news records missing published_at; **393** use Google News proxy URLs.
- **36 active topics**, 11 with zero news items. Empty topics may be intentionally editorial-only. Every news row has a valid topic reference.
- **40** pending research-inbox entries; **25** have exact source_url overlaps with at least one news item.
- **285** source-library entries: **146** missing publisher and **1** missing URL.
- **0** exact duplicated non-null source_url groups *within* news_items; **0** exact duplicate URL groups *within* sources. No claim about cross-collection canonical/semantic duplicates.
- All **11 active research watches** have last_checked_at from Nov 2 or Nov 11 (over seven days old). All **7 active news watches** have NULL last_collected_at. Operational freshness cannot be inferred from recent independent feed polls.
- The **Positive News** collector latest run **Nov 21 13:00 UTC (05:00 PST)** has error, and its saved error begins with an HTML "Just a moment" challenge page. Last recorded successful poll **Nov 11 16:46 UTC**. The other six active feeds' last runs report ok with **zero** items saved. They are not necessarily broken merely because their latest polls saved zero items.
- Correlation still needs explicit review: **17 news_articles**, **0 news_article_topics** links and **4 historical connections**. Don't infer a historical or causal connection from topic co-occurrence.

## 4. Engineering work in draft PR #323

- Added scripts/audit-collection-freshness.mjs and tests/audit-collection-freshness.test.mjs as an **offline, pure, read-only** module; the caller must supply snapshot arrays and a fixed reference clock.
- It distinguishes stale/fresh/missing/future/invalid watch timestamps, and feed error, pending, missing run, fresh success, stale success, and bad timestamps. A successful feed poll saving 0 records does not count as an error; a recent error cannot be hidden by an earlier success.
- Output reports counts and limited names/IDs, without copying source URLs or raw feed errors. It does not connect to Supabase, run on the live collector, or change any records.
- **4/4 local Node 22.16.0 unit tests passed** prior to committing. CI integration or successful GitHub checks are not asserted.
- Engineering next steps: integrate this audit only into a review/reporting workflow after review, investigate Positive News authorized feed availability and HTML access-challenge classification, recover original publisher links, and propose publication dates only with verified source provenance.

**Production boundaries:** No SQL writes, schema migrations, live collector patches, merges, deployments, or automatic publication. All external source figures are attributed and require editorial review.
