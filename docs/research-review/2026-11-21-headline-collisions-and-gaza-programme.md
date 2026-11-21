# Evidence Atlas: headline-collision audit and Gaza positive-action lead (2026-11-21 05:38 PST)

**DRAFT FOR HUMAN EDITORIAL/ENGINEERING REVIEW ONLY.** This is not an approved claim, published story, case record, verified duplicate list, database update, or deployment.

## Primary-source candidate: coordinated child services in Gaza

- Issuer: UNICEF State of Palestine (joint programme announced with Italy, UNFPA, WFP and WHO).
- Released: **20 November 2026**.
- Official source: https://www.unicef.org/sop/press-releases/italy-and-un-agencies-partner-strengthen-integrated-services-children-and-young
- UNICEF announces a **EUR 10 million, 18-month programme** intended to improve education, health, nutrition and protection services for **more than 28,500 people** including children, adolescents, teachers, caregivers and young people in Gaza.
- UNICEF says the programme is **already enabling more than 10,000 school-age children** to attend accelerated learning at four new learning centres; this is the agency's operational report, not independent verification of delivery or outcomes.
- Carefully separate **announced financing**, **targeted beneficiaries**, **reported current participation**, and **future outcomes**. Do not total overlapping subcategories as unique people without verification. Note access/security and sustainability uncertainties.
- Targeted read-only Supabase searches for the exact title, distinctive title fragments and URL slug returned **zero direct matches** in news_items, research_inbox, sources, and news_articles. This does not exclude a semantic or older coverage match.
- Review before use: verify programme financing/implementation with the partner agencies; check timeline and methodology; identify conflicting assessments and on-the-ground constraints. May be appropriate for positive-action and humanitarian-solutions review, but do not equate a planned programme with completed impact.

## Operational snapshot (2026-11-21 13:38 UTC)

- **878 news_items**, all pending review; newest discovery **2026-11-21 12:16 UTC**, unchanged from prior audit.
- **36 active news topics**, 11 empty; **40 pending research inbox entries**, including 25 exact URL overlaps with news_items.
- **412** news items lack publication timestamps; **393** use news.google.com source URLs.
- Source library has **285** records, **146** missing publisher and **1** missing a URL.
- Zero exact duplicate non-null URL groups *within* news_items or *within* sources; this does not establish uniqueness across other collections or URLs after canonicalization.
- Separate read-only SQL identified **8 groups/16 rows** sharing sufficiently long exactly matching whitespace/case-normalized headlines. Examples for review only: (934,4599), (15220,15437), (4357,11157), (9486,13194). Distinct source URLs, editions and news events require human comparison; **not verified duplicates**.
- All **11** active research watch timestamps are older than seven days; all **7** active news-watch collection timestamps are NULL. The research inbox's latest recorded discovery is Nov 10 UTC; independent feed polling does not prove the watches were checked.
- Six feeds' latest recorded runs show success but **0 saved items**; Positive News last failed at **13:00 UTC (05:00 PST)** with an HTML access challenge; last recorded success **Nov 11 16:46 UTC**. The live collector is not fixed.
- Correlation schema: **17 news_articles**, **0 news_article_topics** records, **4 news_historical_connections**. Topic/title similarity alone does not justify linking or causality.

## Review-only engineering addition

- New offline module: scripts/review-headline-collisions.mjs with tests/review-headline-collisions.test.mjs.
- Requires caller-supplied local JSON; outputs **IDs only** for long-title normalized collisions, excludes generic titles, disallows malformed IDs, and does not copy content, URL tokens or source notes.
- Never connects to Supabase, merges records, creates cross-case links, scores truthfulness, or publishes.
- Local Node v22.16.0: **6/6 tests passed**, CLI fixture smoke test passed before commit.
- Results are intentionally more conservative than general semantic duplicate detection. Human reviewers must check publication dates, canonical publisher URL, edition, context and evidence before deciding whether two rows represent the same story.

**Production safety:** No SQL writes, schema changes, collector deployments, merges, production content edits, or automatic publishing were performed in this run.
