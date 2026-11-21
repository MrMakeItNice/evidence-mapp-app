# Evidence Atlas — topic/relationship integrity and primary-source queue (2026-11-21 06:43 PST)

**REVIEW ONLY — NOT APPROVED FOR PUBLICATION OR DATA IMPORT.** Fresh read-only SQL snapshot plus review of issuer-owned pages. Sources' statements are attributed to their publishers; no independently verified outcome or causality is claimed.

## Pipeline snapshot (observed 2026-11-21 ~14:40 UTC)

- **879 news records** (one more than the prior snapshot), **all 879 pending review**. Latest discovery 2026-11-21T13:41:00Z; seven records discovered within six hours of the audit.
- **36 active news topics; 11 have zero news_items**. Empty active topic IDs: 1, 2, 14, 21, 22, 26, 27, 31, 32, 33, 34. These are coverage gaps in this specific collection, not proof that no relevant evidence exists.
- **40 research inbox entries**, all pending, including **25 exact-URL overlaps** with news. Last inbox discovery Nov 10; new news items do not prove research inbox processing.
- **412 news items lack published_at**, **393 source URLs point to Google News**, **146/285 sources lack publisher**, **215/285 sources lack publication_date**, and one source lacks URL. Missing publisher and date are metadata gaps, not evidence of source falsity.
- **0 exact non-null URL duplicates** within news_items and **0** within sources. Eight long-headline collision groups (16 rows) remain unresolved; a shared headline does not prove an identical story. Canonical/semantic duplicate checks are not complete.
- **11/11 research watches stale more than seven days** (latest recorded dates Nov 2 or Nov 11); **7/7 active news watches have NULL last_collected_at**.
- Feed status at inspection: Positive News error at 2026-11-21T14:10Z with HTML challenge; last recorded success 2026-11-11T16:46Z. Five other collectors marked ok and saved zero new records on latest runs; Epstein Files marked pending at 14:40Z, so its outcome was unknown.
- **17 news_articles, 0 news_article_topics, 4 news_historical_connections**. All news_items topic references validated; absence of article-topic joins is a specific gap in the other article collection. Do not equate it with all 879 news_items being unlinked.

### New review-only engineering

- Added offline scripts/audit-topic-coverage.mjs and tests/audit-topic-coverage.test.mjs.
- Examines caller-provided snapshots for empty active topics, news item missing/unknown topic IDs, unlinked articles, orphaned join keys, and duplicate article-topic link pairs.
- Returns ID-only/count-only recommendations; does not copy titles, URLs or source notes. Does not connect to Supabase, infer causality, assign topics, change schema/data, or publish anything.
- Six new local Node tests passed before branch commit. Full repository CI was not run or confirmed. A reviewer should rerun node --test tests/audit-topic-coverage.test.mjs and run with a sanitized snapshot before considering integration.

## Primary source candidate A — positive response and child protection in Gaza

- Issuer: UNICEF State of Palestine. **Released November 20, 2026.**
- Official page: https://www.unicef.org/sop/press-releases/children-claim-their-right-play-gaza-world-childrens-day
- UNICEF announced the **Back to Play!** campaign, building on a previously running **Play to Heal** programme. UNICEF says **more than 100 children** were participating in the campaign launch activity and that **more than 11,000 children** were consulted earlier in 2026 about what they wanted in Gaza.
- Clear separation: the more-than-11,000 figure is **consultation**, more-than-100 refers to a **launch event**, and the campaign's intended reach is an **aspiration**, not independently verified recovery or psychosocial impact. UNICEF's own account describes severe shortages of safe play spaces.
- Targeted direct title/URL searches showed **no exact matching record** in news_items, research_inbox or sources. This does not rule out paraphrased or partially duplicated coverage.
- Editorial check: compare with the already-staged November 20 UNICEF/Italy integrated child services release; these are distinct programmes, not a second record for the same initiative. Seek partner/field reports and measured outcomes before publishing benefit claims.

## Primary source candidate B — planetary science, not proof of life

- Issuer: NASA Science / Johnson Space Center. **Article published November 18, 2026** (page last updated Nov 19).
- Official page: https://science.nasa.gov/blogs/science-news/2026/11/18/nasa-scientists-find-clues-to-ancient-ice-beyond-neptune/
- NASA reports study of **12 stratospheric dust particles** and isotopic signatures suggestive of a reservoir of ancient, heavy-oxygen-enriched water ice in the Kuiper Belt.
- Proper framing: this is a **scientific inference reported by NASA**, not direct sampling of a Kuiper Belt ice deposit or evidence of extraterrestrial life. Consult the linked research paper, methods and alternative material-origin models before editorial approval.
- Targeted direct title/URL checks found **no exact match** in news_items, research_inbox or sources; not a semantic-deduplication guarantee.

## Reviewer actions, not production instructions

1. Verify the UNICEF launch, prior programme details, and independence of outcome metrics; avoid conflating planned reach with results.
2. Read NASA's cited scientific paper and inspect statistical and provenance limitations; present claims as observations/inferences.
3. Prioritize restoring Positive News feed access without bypassing access controls, then recover original publishers and publication dates in review-only suggestions.
4. Review empty categories and article-topic links manually rather than automatically linking material by title similarity; keep factual and speculative connections separate.

**Safety:** No production Supabase writes, schema edits, collector deployments, merges or automatic publication were performed.
