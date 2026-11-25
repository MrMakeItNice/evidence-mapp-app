# Evidence Atlas — source-link and coverage review (2026-11-21 03:36 PST)

**EDITORIAL REVIEW ONLY — NOT approved for database changes, deployment, automatic publication or case-linking.** This draft PR is public; only public source metadata and aggregated read-only figures are documented.

## A. Existing WFP/IOM Gaza news item: provenance enrichment candidate

- Existing database news ID **17683**, in Palestine / Gaza Updates (topic ID 28), pending review.
- Stored headline: *Winter Hits Gaza Hard as Food and Shelter Aid Runs Short, IOM and WFP Warn - International Organization for Migration*.
- Current URL is a Google News RSS proxy; publisher saved as International Organization for Migration (via Google News). The stored publication date is NULL. News discovery: Nov 20, 2026 22:46 UTC.
- Official primary publisher page: **World Food Programme**, dated **Nov 17, 2026**: https://www.wfp.org/news/winter-hits-gaza-hard-food-and-shelter-aid-runs-short-iom-and-wfp-warn
- WFP and IOM state that winter conditions and funding shortfalls are straining Gaza aid, citing 1.7 million displaced and 1.4 million facing acute hunger. Those are agency-reported estimates, not independently verified Evidence Atlas conclusions.
- **Review required:** compare official WFP version, possible IOM version, and stored news headline. If verified, propose attaching the publisher URL and November 17 date while preserving the original proxy for traceability. Matching headlines alone do not establish version identity.
- This is an **existing item needing possible source enrichment**, not a missing new case.

## B. Positive oversight research candidate

- U.S. Government Accountability Office (GAO), *Performance and Accountability Report: Fiscal Year 2026*, report **GAO-27-900726**.
- Published and publicly released **Nov 16, 2026**; official link https://www.gao.gov/products/gao-27-900726
- GAO reports **$62.5 billion** in FY2026 financial benefits from its work and **1,296** federal program improvements. These are GAO's own performance measures; they are not independent Evidence Atlas impact verification.
- Targeted headline, URL, and report-ID checks returned no direct matches in news items, research inbox, sources, or news articles. This does not exclude semantic duplicates or historical archive matches.
- **Review required:** validate attribution and methodology and check external auditor information before considering a positive-government-oversight entry.

## Read-only pipeline audit

- **877** news items, all pending; **411** missing publication dates; **392** Google News proxy URLs; newest discovery Nov 21 10:31 UTC.
- **36** active news topics; **11** currently contain zero news items. Empty categories may be intentional.
- **40** pending research-inbox records, with **25** exact URL overlaps against news items.
- **285** sources: **146** missing publisher information; **1** lacks a URL.
- No exact repeated-URL groups within news items or within sources. Canonicalized duplicates not verified.
- All **11** active research watches are over seven days stale; all **7** news-watch collection timestamps are NULL.
- **17** news articles, **0** article-topic links, **4** historical connections: no automatic relationship assignment authorized.
- Collector: six feeds report success and saved zero records on their latest completed runs. Palestine/Gaza was pending. Positive News failed with HTTP 403 HTML challenge at Nov 21 03:15 PST; its last success was Nov 11.

## Engineering review proposal

New standalone **scripts/suggest-source-links.mjs** and **tests/suggest-source-links.test.mjs** use a human-curated list of candidate primary-source titles to suggest **exact normalized title** matches. The function recognizes a trailing publisher suffix only if it matches the stored publisher, rejects ambiguous and short titles, and outputs only IDs and a human-review requirement. It performs no network, database, or publishing operations and does not export URLs.

**Five new local Node tests passed**: WFP title, publisher mismatch, report-ID distinction, ambiguity/short-title rejection, and invalid inputs. Local testing does not imply CI approval or live collector integration. Human source comparison is still required before any link or publication is approved.
