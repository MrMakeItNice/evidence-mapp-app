# Research review queue — November 21, 2026 (01:06 PST)

**Review-only working note. Not verified editorial content. No Supabase write, publication, or deployment authorized.** This repository is public, so PR materials themselves may be publicly accessible.

## 1. Federal immigration detention spending — primary-source lead

- **Primary publisher:** U.S. Government Accountability Office (GAO)
- **Report:** GAO-27-108665, *Immigration Detention: ICE Should Determine Cost Effectiveness of New Initiatives Before Continuing*
- **Official URL:** https://www.gao.gov/products/gao-27-108665
- **Published / publicly released:** November 19, 2026
- **Reported finding:** GAO says ICE acquired 11 warehouses for approximately $1.07 billion, then scaled down its warehouse initiative and planned to sell seven. GAO also says ICE acquired four existing detention facilities for about $2.2 billion in July–August 2026, and found gaps in the current spending plan and life-cycle investment estimates.
- **Agency response per GAO:** DHS concurred with GAO's two recommendations.
- **Status:** Unassessed lead. GAO's audit findings are attributed to GAO; they are not independent Evidence Atlas verification or proof of misconduct. Need review of methodology, time periods, recommendation responses, and the full report before publication.
- **Suggested topical links:** Government oversight, public spending, detention policy. **Do not automatically attach to cases or infer wrongdoing.**

## 2. Federal website accessibility — primary-source lead

- **Primary publisher:** U.S. Government Accountability Office (GAO)
- **Report:** GAO-27-107934, *Federal Accessibility: Agencies Not Consistently Meeting the Information and Communication Technology Needs of People with Disabilities*
- **Official URL:** https://www.gao.gov/products/gao-27-107934
- **Published / publicly released:** November 19, 2026
- **Reported finding:** GAO says 14 of the 23 agencies receiving covert accessibility feedback fixed identified issues during its test period; nine had not fixed them as of May 2026. GAO also identified testing-practice gaps at USDA and HUD among three agencies studied in depth.
- **Agency response per GAO:** USDA and HUD neither agreed nor disagreed with the respective recommendations.
- **Status:** Unassessed lead. Sample size and selection limit generalization; do not claim all federal agencies perform identically. Examine the full methodology and updated agency responses.
- **Suggested topical links:** Digital rights, access to public services, government oversight.

## 3. Database cross-check (read only)

As of this run, focused searches for `GAO-27-108665` and `GAO-27-107934` plus the respective headline keywords found **no matching report identifier or title** in `public.news_items`, `public.research_inbox`, or `public.sources`. Generic references to *detention* are not matches to the GAO report. This is a targeted check, not a full-text search of all external files.

Read-only quality counters at audit time:

| Measure | Count |
| --- | ---: |
| News items / pending review | 873 / 873 |
| Active news topics | 36 |
| Pending research inbox | 40 |
| Active research watches | 11 |
| Active news watches | 7 |
| News items missing publication date | 408 |
| News items using Google News proxy URLs | 389 |
| Sources missing publisher metadata | 146 / 285 |
| Sources missing URL | 1 / 285 |
| Exact news-item ↔ research-inbox URL overlaps | 25 |

The 11 active research watches' `last_checked_at` values predate November 12; the seven active news watches have `last_collected_at IS NULL`. News-feed activity does **not** establish that those watch workflows have run.

**URL provenance caution:** Sources `119` and `138` have query parameter keys spelled `id;` and `library;` in their stored HUDOC links. Verify the canonical originals before correcting anything. The six `hudoc.echr.coe.int/app/conversion/pdf` paths refer to potentially different ECHR documents through distinct query parameters, **not six confirmed duplicates**. Dropping all query parameters during deduplication would create false matches.

**Collector blocker:** The separate `atlas_monitor` RSS job reports Positive News HTTP 403 with an HTML `Just a moment...` challenge page; most recent failure was November 21, 2026 at 00:55 PST, last success November 11. Its scheduler and feed records live in `atlas_monitor`, not the distinct repository `evidence-news-collector` GDELT function. Investigate job implementation before proposing any production edit. Recommended behavior: classify 403/HTML challenges explicitly, log safe metadata rather than full challenge HTML, and avoid interpreting them as news content. No collector configuration was changed.

## 4. Safe provenance-review tooling proposed in this PR

`node scripts/review-source-urls.mjs sources.json` runs against a **local JSON export** (or stdin), requires no Supabase key, performs no network access, and produces review-only URL flags and conservative duplicate suggestions. It strips only known tracking parameters and fragments; functional report IDs remain. It does not rewrite URLs, deduplicate rows, assert document identity, or publish anything. Tests: `node --test tests/review-source-urls.test.mjs`.

## 5. Editorial gates before any later publication

1. Read each GAO full report and check precise figures, periods, scope, agency replies, and corrections.
2. Search by stable report number and canonical URL across all source registers and research-review PRs; do not mistake topical overlap for duplicate records.
3. Preserve attribution: a GAO finding is a documented government-audit finding, not by itself proof of broader coordination or criminal activity.
4. Link reviewed source and contrasting evidence to a defined claim only after explicit human approval.
5. Keep review notes out of the production website until editorial clearance; this public repository's draft PR may itself be visible.
