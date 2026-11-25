# Evidence Atlas research review — November 21, 2026, evening Pacific

**Unapproved evidence candidates and engineering diagnostics. Public draft PR notes are not editorial publication.** No production ingestion, schema change, deployment or automatic claim publication.

## Live read-only audit, 2026-11-22 02:26 UTC

- **919 news items**, all pending; **437 without `published_at`**, including **418 of 418** Google News proxy URLs (the other 19 missing dates are non-proxy). This association suggests examining Google News RSS metadata extraction, but does not establish the underlying defect.
- **36 active news topics; 11 empty**. **17 separate news articles; 0 topic links.**
- **40 pending research-inbox entries; 25 exact URL overlaps** with news and 4 unassigned to a research watch. Overlap does not mean duplicate editorial purpose. **8 case-insensitive long-headline collision groups**; no exact repeated URLs within the news collection.
- **285 source-library records**; 146 lack publisher, 215 lack date, one lacks URL; no exact repeated URLs within that collection.
- All **11 research-watch timestamps are older than seven days**; all **7 news watches lack collection timestamps**. The MKULTRA archive, disputed-death and Epstein court/custody watches each have no linked inbox record, not proof of no research.
- **143 cases**, with 140 having registered-source references. Only one case has structured claims; do not infer the other cases have no evidence.

### Collector-health finding — high priority

At inspection, Positive News's newest run (02:25 UTC) was still *pending*, but its most recent **completed** run (01:50 UTC) returned HTTP 403 and an HTML access challenge. **41 completed Positive News polls in the prior 24 hours all returned 403**, saving zero; last recorded successful feed timestamp is November 11 at 16:46 UTC. This is an operational failure masked by the pending latest status, not an article-quality conclusion.

Six other collectors had recent HTTP-200 successful polls and reported **52 total saves** over the previous 24 hours; reported saves are not proven unique or approved for publication. A successful zero-item run is still a success.

The new offline `audit-feed-failure-streaks.mjs` accepts local snapshots of `agent_control_feeds` and `agent_control_activity` and reports the last *completed* status, HTTP code, consecutive error count, pending flag and last-success age. It emits IDs only (not raw URL/error/name), never makes network calls, changes feeds or bypasses access controls. Review official permitted alternate RSS sources or provider support; do not circumvent challenge protections.

## Primary sources for human review

### WHO EB160/8: noncommunicable diseases and mental health

**Original:** https://apps.who.int/gb/ebwha/pdf_files/EB160/B160_8-en.pdf

**Date and form:** November 20, 2026; report by the WHO Director-General to the 160th Executive Board. The cover and introductory sections identify the document and scope. WHO reports 45 million noncommunicable-disease deaths in 2023 and summarizes work on sustainable financing, medicines and primary care. Paragraph 11 says WHO, the Philippines and Asian Development Bank **plan** to convene an international financing dialogue in early 2027.

**Evidence distinction:** This is a WHO Secretariat report, not an independent audit or proof of financial transfers. Do not mistake intended dialogues for completed funding agreements. Verify statistical methodologies, finance records, any subsequent Board decisions and independent accounts before adding public claims. Suitable for the WHO financing/policy research queue.

### DOJ release 26-1395: arrest announced; criminal allegations are not findings of guilt

**Original:** https://www.justice.gov/opa/pr/senior-leader-sinaloa-cartel-and-one-fbis-ten-most-wanted-fugitives-arrested-mexico

**Dates:** DOJ published November 21, 2026, saying Mexican military forces arrested Fausto Isidro Meza Flores on November 20. DOJ says a second superseding indictment was returned September 25.

**Evidence distinction:** A contemporaneous U.S. government announcement establishes what DOJ reported, not independent verification of the operation. The cartel-leadership and misconduct allegations are **unadjudicated** in this release; arrest and indictment are not convictions. For any public article, check a Mexican official source and docket, distinguish charges from established facts and revisit later corrections.

**Duplicate screening:** Targeted read-only official-URL, document-ID and literal-title searches found **no direct matching records** for these two primary documents in news, sources or inbox. These are not exhaustive semantic searches and do not justify automatic insertion or linking.

## Safeguards

Do not infer publication dates from discovery timestamps; do not merge syndicated URLs or match claims from headlines alone. Confirm original document identities, correction history, competing explanations and scope. All findings remain **review-only**. Node's eight focused offline unit tests and one CLI smoke test passed locally; full GitHub CI is a separate, not-yet-proven check.
