# Evidence Atlas — cross-register provenance, collection health, water/environment leads
**Read-only inspection: 2026-11-21 ~13:50 PST. Review-only, public draft PR. No authorization to publish or insert into production.**

## Production snapshot (read-only SQL)
Project: `nxlffnplqdobfqxogmxo`.
- `news_items`: **885** total and **885 pending review** (+2 from the earlier 883-record audit). **415** lack `published_at`; all **396/396** Google News proxy links lack publication timestamps. Correlation is not root-cause proof.
- `news_topics`: **36** active, **11** without news items. `research_inbox`: **40 pending**, including **25 exact URL overlaps** with `news_items` (different editorial roles can coexist).
- `sources`: **285**, of which **146** lack publisher metadata, **215** lack publication dates, and **1** lacks a URL.
- No exact repeated-URL groups within `news_items` or within `sources` (this does **not** exclude canonical or semantic duplicates).
- `research_watch_topics`: **11 active**, all last checked more than seven days ago or never checked. `news_watch_topics`: **7 active**, all with null `last_collected_at`. Feed run logs are maintained separately; null watch timestamps do not prove complete collector stoppage.
- Evidence graph: **143 cases**, **219 case-to-register links** across **147 register entries**, all register entries currently have source IDs; **140** cases have at least one case/register link. Only **one** case has structured claims (five claim rows). This does not imply the others are unsupported: evidence also exists in narrative and reference fields.

## Newly identified multi-register source-path candidate
Case ID **26** reaches source ID **26** via two register rows, **32** and **46**. Both belong to `cases_1_100`, cite original PDF page **11**, and have different reference codes (**S32**, **S46**). Both case-source link roles are `cited_by_master_index`.
- This is exactly **one** group of a repeated case/source path across distinct register IDs in this snapshot, involving **two** links.
- **Not a confirmed duplicate or error**. Separate original citations, variants, and intentional cross-indexing are possible. Check the original master PDF, bibliography, report version, and source identity before any decision. **No deletion or merging.**
- Existing `audit-case-evidence-coverage.mjs` now outputs `multi_register_same_source_review_candidates`, containing only numeric case/source/register IDs when different register IDs resolve to the same source within a case. Repeated identical register links do not produce a multi-register false positive; unresolved sources are excluded. Prior diagnostics remain intact.
- Two regression cases appended; the nine test cases from the repository test file passed in an isolated JavaScript harness after stripping Node-only import/CLI boilerplate. **The actual Node runner, repository-wide suite, and GitHub CI have not been verified**. Code remains in an unmerged draft PR.

## Primary-source candidate A — water conservation measurement
**NASA Landsat / OpenET**, *Satellites Reveal the Thirst of Fields and Forests*, published **November 19, 2026**.
Official source: https://science.nasa.gov/mission/landsat/news/satellites-reveal-the-thirst-of-fields-and-forests/

NASA describes a peer-reviewed study using Landsat and OpenET models to estimate evapotranspiration for crops and forests across the Lower Mississippi Alluvial Plain, examining **2016–2022** patterns. Field-scale estimated water loss can inform irrigation decisions and groundwater resource planning. These are model-based estimates and potential applications, **not proof of measured water savings** or validation at every local site. Human review should inspect the original Duan et al. paper, uncertainties, model validation and regional limits before classifying outcomes or linking water projects.

**Direct-match check:** Exact headline fragment and canonical URL substring searches returned zero matches in news, inbox, and sources. This does not exclude related coverage under different wording.

## Primary-source candidate B — environmental cleanup accountability
**U.S. EPA**, *EPA Announces Consent Decree for CFAC Site*, notice published **November 20, 2026**.
Official source: https://www.epa.gov/mt/epa-announces-consent-decree-cfac-site

EPA reports that a federal consent decree was **entered November 12, 2026**, under which Columbia Falls Aluminum Company agreed to pay response costs and conduct cleanup actions totaling **$57 million**. EPA and Montana DEQ will oversee implementation. The main slurry-wall construction is **planned for 2027**, not completed. This is an EPA notice; verify the underlying judicial decree, cleanup scope, historic liability, and subsequent implementation. Do not present announced remedial work as achieved environmental recovery.

**Direct-match check:** Targeted official-URL and title-fragment checks returned zero news, inbox or source matches. Check aliases, related site cases and the original decree to avoid double-counting before editorial approval.

## Collector evidence and recommended safe follow-up
- At ~13:50 PST `agent_control_feeds`: **Positive News** latest run at **13:45 PST** had `error` and an HTML “Just a moment...” access challenge; its last recorded success is **November 11**. Do not bypass access controls. Obtain a supported permitted official feed endpoint or publisher guidance and test collector behavior before deployment.
- Six other feeds showed `ok` on latest run. Public Health — BBC and COVID-19 — Google News each saved **one** item; the other four saved zero.
- Prioritize permitted RSS metadata capture to understand the **396/396 Google News date gap** without guessing a publication time or using discovery time as a substitute.
- The two new primary sources are **editorial candidates only**. Require human verification, competing/contrary evidence, and explicit publisher attribution before promotion to case/news entries.

**No Supabase mutation, schema change, deployment, merge, source publication or automatic case linking performed.**
