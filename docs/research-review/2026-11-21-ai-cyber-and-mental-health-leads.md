# Evidence Atlas — November 21, 2026, 02:44 PST research and collector review

**Human editorial review only — NOT approved for website publication, database insertion, case linking, or a claim of wrongdoing.** This note resides in a public draft PR. It contains only public primary-source metadata and aggregated read-only audit counts.

## Primary-source candidate A — AI cybersecurity policy options

- **Primary publisher:** U.S. Government Accountability Office (GAO)
- **Report identifier:** GAO-27-108458
- **Title:** *AI and Cybersecurity: Technologies Can Magnify Cyberattacks and Enhance Cyber Defense*
- **Official URL:** https://www.gao.gov/products/gao-27-108458
- **Published and publicly released:** November 20, 2026 (GAO's own report page)
- **Attributable finding:** GAO describes opportunities for AI-assisted cyber defense and evolving risks from AI-assisted threats. The report identifies four possible policy goals and 16 *options*, not legal requirements or settled evidence that a particular actor committed misconduct.
- **Evidence basis and limitations:** GAO states it reviewed literature and government materials, consulted government, academic, and industry stakeholders, and convened a multi-day expert meeting. Examples of cyberattacks cited by GAO are drawn in part from industry reporting; independent case-by-case forensic corroboration is still required.
- **Next human checks:** Review the full 70-page report, distinguish documented incidents from expert forecasts, inspect cited source documents, and check for subsequent policy or agency responses.
- **Suggested topic mapping for review:** Digital rights and AI; Government oversight; Technology and Privacy. Do **not** automatically link allegations, named individuals or conspiracy cases.

## Primary-source candidate B — AI chatbots and mental-health support

- **Primary publisher:** U.S. Government Accountability Office (GAO)
- **Report identifier:** GAO-27-109184
- **Title:** *Science & Tech Spotlight: AI Chatbots and Mental Health*
- **Official URL:** https://www.gao.gov/products/gao-27-109184
- **Published and publicly released:** November 20, 2026
- **Attributable findings:** GAO's two-page spotlight presents potential benefits (access to resources and professional support) and risks (uncertain efficacy, over-agreeableness, vulnerable-user safety, privacy). It says that **as of November 2026**, FDA had not granted marketing authorization for mental-health chatbots. This is a time-bounded GAO report claim, not a timeless conclusion or evidence that every chatbot is unsafe.
- **Evidence basis and limitations:** Technology spotlight summarizing cited research and expert concerns, not an independent clinical trial of individual products. Separate actual safety incidents, proposed policy responses, marketing claims and demonstrated outcomes.
- **Next human checks:** Verify relevant FDA listings and regulatory language directly; review cited APA/National Academy of Medicine materials, clinical evidence and countervailing data. Preserve the risks **and** possible benefits in any editorial synthesis.
- **Suggested topic mapping for review:** Public health; Digital rights and AI; Clinical Research & Safety. No automatic case or person association.

## Targeted Supabase check (read only)

Snapshot at 2026-11-21 10:44 UTC (02:44 PST), project `nxlffnplqdobfqxogmxo`:

- `public.news_items`: **877 total / 877 pending editorial review**, three newer than the previous 874-record audit; 65 records discovered in the preceding 24 hours.
- `public.news_topics`: **36 active**; `public.research_inbox`: **40 pending** and no discoveries during the prior 24 hours.
- `public.research_watch_topics`: **11 active**, all with `last_checked_at` older than seven days; `public.news_watch_topics`: **7 active**, all without `last_collected_at`.
- News records missing `published_at`: **411**; using Google News proxy URL: **392**; source records missing publisher: **146 of 285**; source records missing URL: **1**; source records missing publication date: **215**.
- Exact duplicate URL groups: **0** in news items and **0** in sources. Exact URL overlap between inbox and news: **25** inbox entries; *canonicalized* cross-table matching is not established.
- Targeted identifier/title/GAO-URL substring checks for **GAO-27-108458** and **GAO-27-109184** yielded **zero direct matches** across `news_items`, `research_inbox`, and `sources`. This does not rule out thematic overlap or external archived sources.
- Most recent three `news_items` were collected in the COVID-19 watch at 02:31 PST and have no publication date. Their article contents were **not independently verified**.

## Operational blocker and engineering proposal

At snapshot time, `agent_control_feeds` recorded **six successful latest runs** (COVID-19 saved three records, five feeds saved zero). The Positive News feed had a **pending** run started 02:40 PST; its latest outcome was **not yet established**, and its last recorded successful run was November 11.

A recurring HTTP 403 HTML access challenge was observed in earlier audits. New `scripts/classify-feed-response.mjs` is a **pure, offline triage helper** and `tests/classify-feed-response.test.mjs` includes seven passing local Node test cases. It distinguishes an access challenge from RSS XML, ordinary HTTP failures, and rate limiting; does not echo response bodies or bypass access controls. Its `feed_xml_candidate` result is **not an XML validity claim or permission to ingest**.

**Integration not complete:** The actual scheduled collector is managed separately in `atlas_monitor`; this PR does not modify its runtime, authentication, feeds, retry logic, or database records. To fix the live issue, a maintainer must inspect the deployed collector, validate a permitted official RSS endpoint or seek publisher support, and add safe integration tests before any controlled rollout. Never defeat CAPTCHAs or access controls.

**Required pre-publication review:** Confirm primary documents, competing explanations, precise dates, methodology and scope; cross-check provenance and duplicates; have a human editor approve explicit claims and links. No changes to production schema/data, published research, or deployments are authorized by this note.
