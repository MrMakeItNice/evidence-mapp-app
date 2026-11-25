# Evidence Atlas research review — November 21, 2026, 7:10 PM Pacific

**Review only. Not editorial approval or publication.** These notes are not proof of wrongdoing, live collection, or unique stories; do not insert into Supabase or deploy without review.

## Read-only audit

At inspection, the production database reported **922 news records**, all pending review, including **440 with no publication date**. **421 Google News proxy records all lack a publication date**; 19 other records also lack one. There were 3 records with discovery timestamps in the preceding hour and 55 in the preceding 24 hours. **36 news topics active, 11 with no linked items**; 17 separate news articles without topic links.

Research inbox: 40 pending entries and 25 exact URL matches in the news collection (not automatically duplicates). Source library: 285 items, 146 without publisher information, 215 without publication dates, one without a URL. No repeated exact-URL groups within news or sources; four exact case-insensitive long-headline collision groups in the >85-character cohort. All 11 research watches have no recent check timestamp and all 7 news watches lack collection timestamps. There are 143 cases, with structured claims in only one; this does **not** imply the other cases lack documentary evidence.

### Collector-history truncation / coverage limitation

The agent_control_activity table exposed **203 retained rows: 29 per feed across seven feeds**. Oldest visible requests were November 21 at approximately **10:20–10:50 UTC**, while the newest was November 22 at 03:10 UTC: each feed's visible history covers only about 16–17 hours, **not a complete 24 hours**. This does not establish the database's retention policy; it establishes that these query results cannot support exhaustive last-24h counts.

Of the **29 retained Positive News runs**, all 29 completed with HTTP 403 and none was successful. Its last_success_at was November 11 at 16:46 UTC. The six other feeds had successful latest runs; World News was pending at the last live snapshot. Reports from the previous checkpoint of more than 29 failures should not be overwritten by a false claim that only 29 occurred in the day. Avoid circumventing access challenges; verify official allowed feeds or seek provider support.

The offline audit script 'audit-collector-history-window.mjs' labels counts as **observed**, flags whether an input snapshot even reaches the requested time boundary, and indicates when the streak may precede the oldest available row. It outputs numeric IDs/counts only; no secrets, feed content, or production access. A boundary record still cannot prove there are no internal gaps.

## Government primary-source review candidates

### NARA FY2026 Q4 declassification release list

Source: https://www.archives.gov/declassification/ndc/release-lists

NARA's page is **dated October 1, 2026** and states that **107 entries completed declassification processing between April 7 and September 30, 2026**. Highlights include Strategic Arms Limitation Talks records, embassy collections, and satellite program files. **An entry on the release list is not proof that every underlying document has been digitized, released online, or is accessible without additional review**; NARA warns some records may require further screening or FOIA. Candidate for a declassified-records *discovery queue*, not 107 new cases. Before record-by-record linking, retrieve original release-list formats, accession/series metadata, document availability and prior case overlaps.

### NARA November 2026 FAQ: non-compliant digitized permanent records

Source: https://www.archives.gov/records-mgmt/policy/non-compliant-digitized

Page identifies its **issue month as November 2026**, without an exact day. NARA distinguishes source records from digitized copies and describes conditions for transfer and disposition under 36 CFR Part 1236 Subpart E and GRS 4.5. This is **policy/record-integrity guidance**, not evidence that any particular records have been destroyed or suppressed. Potential value: source provenance fields for version, digitization conformance, existence of original, accession/record-group, and access restriction. Validate with applicable regulations and later official revisions before representing legal requirements.

Targeted title, document-ID and URL searches in news, sources and research inbox returned no direct matches for either NARA candidate. This is **not** exhaustive semantic deduplication. Editorial review remains required.

## Safety / release checks

No production SQL writes, schema modification, feed retries, deployments, PR merge or automatic publication. No exact URLs or sensitive document fields are emitted by the new diagnostic. Five focused local tests and a Node syntax check passed on the standalone script in a local working copy; CI for the PR must be verified separately.