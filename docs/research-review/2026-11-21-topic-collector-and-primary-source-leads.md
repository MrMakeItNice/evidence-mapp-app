# Evidence Atlas — topic-collector review and source leads (2026-11-21 PST)

**Review-only.** This note is not approval to publish, merge, deploy, or update Supabase data/schema. Database checks were SELECT-only. Numbers are point-in-time observations and may change independently.

## New coverage finding

A read-only comparison of active news-topic IDs to \`public.news_items.topic_id\` and active \`atlas_monitor.feeds.topic_id\` found:
- 36 active news topics;
- 11 active news topics with **zero news items**;
- **all 11** of those empty topics also have **zero active collector feeds**.
- Empty groups include editorial categories such as Corrections & Follow-Ups, Media Corrections, Research Methods & Bias, and Primary Documents & Archives. An empty editorial category does not imply a broken feed.

The accompanying offline tool classifies \`has_items\`, \`empty_with_active_feed\` and \`empty_without_active_feed\` separately. It receives only safe local JSON snapshots and returns topic IDs/counts; it does **not** connect to Supabase or infer collector failures from an editorial category.

## Point-in-time read-only snapshot

- \`news_items\`: 922, all pending review; 440 missing \`published_at\`, of which 421 use Google News proxy URLs.
- \`research_inbox\`: 40, all pending; 25 exact URL overlaps with \`news_items\`; 4 inbox entries lack a watch-topic assignment.
- \`sources\`: 285; 146 missing publisher, 215 missing publication date, 1 missing URL.
- No exact repeated-URL groups found **within** \`news_items\` or **within** \`sources\`; 5 exact matches **across** sources and news items. An exact URL match is a suggestion for review, not a verified evidence link.
- 11/11 active research watches are older than seven days or unrecorded; 7/7 news watches have null last-collection timestamps. Three active research watches have no linked inbox entries.
- \`news_articles\`: 17, none with entries in \`news_article_topics\`; these are distinct from \`news_items\`.
- Positive News: 41 of 41 retained completed runs in the preceding 24-hour query returned HTTP 403, zero saved; last recorded success 2026-11-11. Six other feeds' latest completed runs were successful. Retained history may not represent every attempted poll.

## Newly identified official primary-source candidates — NOT APPROVED

1. **GAO-27-109184, Science & Tech Spotlight: AI Chatbots and Mental Health** — published and publicly released November 20, 2026. Official: https://www.gao.gov/products/gao-27-109184 . GAO describes use, limitations and safety risks of AI chatbots as mental-health support, and reports no FDA marketing authorization for mental-health chatbots as of its report. Editorial caveat: attribute GAO's synthesis and avoid asserting that any particular AI tool has been adjudged unsafe.
2. **GAO-27-108458, AI and Cybersecurity: Technologies Can Magnify Cyberattacks and Enhance Cyber Defense** — published and released November 20, 2026. Official: https://www.gao.gov/products/gao-27-108458 . GAO describes dual-use risks, defensive applications and policy options. Distinguish sourced incident examples and expert synthesis from independently proven prevalence or causal attribution.
3. **SEC File S7-2026-40 / Release 34-106950, Restructuring the Governance and Funding Model of the Consolidated Audit Trail** — proposed November 20, 2026. Official docket: https://www.sec.gov/rules-regulations/2026/11/s7-2026-40 ; announcement: https://www.sec.gov/newsroom/press-releases/2026-117-sec-issues-proposal-restructure-consolidated-audit-trail . This is a **proposed rule**, not an adopted change. Comment deadline is 60 days after Federal Register publication; do not assign a calendar deadline without verifying publication date.

Targeted **identifier/title-text** searches across \`sources\`, \`news_items\` and \`research_inbox\` returned zero direct matches for \`GAO-27-109184\`, \`GAO-27-108458\`, \`S7-2026-40\`, \`consolidated audit trail\`, and the two GAO report titles. These checks are not an exhaustive semantic search; do not create duplicates on this basis alone.

## Review requirements

- Run \`node --test tests/audit-topic-collector-coverage.test.mjs\` and inspect PR CI before any merge.
- Require explicit editorial approval before adding any primary source, claims, or cross-links to the database.
- Resolve whether empty topics are deliberately editorial/manual before proposing new feed subscriptions. Do not assume all 11 require collectors.
- Treat Google News \`published_at\` gaps as a separate metadata-loss investigation; never backfill dates from matching titles or proxy URLs alone.
- Diagnose Positive News 403 via allowed feed/service terms; do not bypass access controls.
- Keep earlier large draft research PR #323 and source-coverage PR #347 separate; this branch adds no migration, deployed collector, site code, or production data.
