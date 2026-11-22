# Evidence Atlas — report-ID correlation and oversight leads

**Editorial status:** staged for human review only; not approved for public Evidence Atlas publication or database insertion.  
**Inspected:** November 21, 2026, approximately 16:10 PST.  
**Data scope:** read-only Supabase project nxlffnplqdobfqxogmxo.

## Read-only pipeline snapshot

- 897 news records, all pending editorial review; 421 missing publication dates.
- 402 Google News RSS proxy URLs, **all 402 lacking publication dates**. This correlation does not establish the collector's root cause.
- 36 active news topics, including 11 with no news records. Several are reference/editorial categories; an empty topic is not automatically a broken feed.
- 40 pending research-inbox entries, including 25 exact URL matches to news records. These are editorial overlaps, not verified duplicates.
- 285 registered sources: 146 missing publisher metadata, 215 missing publication dates, one missing URL.
- Zero exact repeated nonblank URL groups **within** news or within registered sources. Eight case-insensitive long-headline collision groups (16 rows) remain *potential*, not proven, duplicates.
- 11 active research watches have last-checked timestamps from November 2 or 11 (all older than seven days). All seven active news watches have no last-collected timestamp.
- None of 17 separate news-article records have article-topic links.
- Positive News feed: its 16:05 PST attempt failed with an HTML access challenge; last recorded successful run November 11. Do not attempt to bypass access controls. World News — BBC's latest completed run saved three items; Government — BBC was pending at inspection.

## Primary-source lead A: GAO-27-109420

- **Original:** https://www.gao.gov/products/gao-27-109420
- **Agency:** United States Government Accountability Office
- **Published / publicly released:** November 19, 2026
- **Report:** DOD Munitions: Planning and Leadership Needed to Address Persistent Shortages
- **Attributed finding:** GAO reports that DOD lacks an overarching munitions plan linking long-term requirements, production and spending, and calls for clearer leadership, inventory reconciliation and data-management processes. Its **four recommendations** were displayed as **open** on inspection; DOD generally concurred.
- **Critical limitation:** This is the *public version* of a classified September 24 report. Classified and sensitive inventory details have been omitted. Do not infer specific weapons quantities, precise readiness impacts, concealed misconduct, or implementation of recommendations.
- **Verification required:** Consult the full public report, DOD response and subsequent recommendation status before case/source linkage or publication.

## Primary-source lead B: GAO-27-108744

- **Original:** https://www.gao.gov/products/gao-27-108744
- **Agency:** United States Government Accountability Office
- **Published / publicly released:** November 16, 2026
- **Report:** Federal Prisons: Improved Reviews of Natural Deaths and Communications with Families Needed
- **Attributed findings:** BOP recorded approximately **3,000** deaths classified as natural causes in custody during FY2016–FY2025. In GAO's examination of **FY2024** natural-death investigation records, BOP identified health-care deficiencies in **45%** of the deaths examined; some deficiencies contributed to deaths. GAO issued **13 recommendations** about death reviews, notifying families and corrective action records. BOP concurred; all 13 were displayed as open at inspection.
- **Critical limitation:** Do **not** generalize the FY2024 45% finding to the full 2016–2025 period, infer criminal guilt in an individual death, or confuse GAO's oversight findings with court rulings.
- **Verification required:** Examine methodology, BOP responses, later status changes and the facts of any proposed related case.

## Direct-match and correlation checks

Targeted read-only SQL searches for the two GAO report IDs, URLs and relevant titles found **no direct matches** in the news, source or research-inbox collections. Cases #76 and #77 concern historical prison experiments; topical similarity is **not** evidence of a factual connection to the modern BOP report.

Added an offline GAO public-report-ID correlation aid at scripts/suggest-report-id-links.mjs. It compares supplied snapshots across news, registered sources and research inbox, recognizes public GAO-YY-NNNNNN identifiers from titles or official HTTPS gao.gov report/product paths, refuses ambiguous or conflicting identifiers, and emits numeric record IDs plus public report IDs only. It does not access Supabase, retrieve content, link records, modify data, or approve research. Even exact report-ID matches remain **review candidates, not verified source equivalence**. Independent original-document review remains mandatory.

**No production writes, schema changes, deployments, PR merges or automatic editorial publication are authorized by this note.**
