# Evidence Atlas

A source-grounded research workspace for case files, claims, source references, people, organizations, connection maps, timelines, and modeled outcomes. This repo hosts the static browser frontend; the existing Supabase project stores the research records.

## Live app (Supabase Edge Functions)

**Current release:** v1.6.0 (140 original cases preserved; separate Epstein Files, COVID-19 and Palestine/Gaza workspaces, source and timeline tools, and group-tagged daily monitoring).

**Open Evidence Atlas:** https://nxlffnplqdobfqxogmxo.supabase.co/functions/v1/evidence-atlas

Supabase reports deployment `evidence-atlas` active. The site is publicly reachable as an application shell; existing research remains accessible only after owner sign-in. For an anonymous visitor, **Explore a sample workspace** opens only fictitious demonstration records.

The current release is also committed as `index.html` in this repository, so GitHub Pages can be enabled separately for a shorter address. To update the Edge Function, redeploy its HTML response with the latest committed `index.html`.

## Optional: publish using GitHub Pages

1. In this repository, open **Settings → Pages** (https://github.com/MrMakeItNice/evidence-mapp-app/settings/pages).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/(root)**, then **Save**.
4. Once GitHub finishes publishing, open **https://mrmakeitnice.github.io/evidence-mapp-app/**.

If Settings or Pages is unavailable, the GitHub app may not have administrative permission; enable Pages directly through your own GitHub browser session.

## Sign-in and demo

- Sign in with the existing authorized **Supabase Auth** owner's email and password. This is not necessarily the password for the Supabase dashboard.
- **Explore a sample workspace** loads fictitious records and cannot write to the real database.
- The public website serves application code. Its case contents are not made public by Pages.
- Records are fetched from Supabase only after owner authentication; row-level security (RLS) controls database reads and writes.

## Security

This repository is **public**. Never add passwords, private research exports, service-role/secret keys, or authentication tokens. The publishable Supabase API key embedded in the page is intended for use in browser apps. Preserve Supabase RLS policies; do not weaken them to enable Pages.

## Features

- Research overview and evidence coverage
- Searchable 140-case master index, owner-only working drafts, people, organization and source library
- 147 bibliography register entries and 219 case-to-source references with original PDF source-page provenance
- Source-linked claims and evidence status filters
- Case-focused relationship map and source-overlap comparisons (shared citations ≠ causation)
- Date-based timeline
- Draft solution proposals and modeled possible outcomes
- Owner-protected record creation, editing, and JSON export
- Owner-only CSV case catalog import with a preview, duplicate-title skipping, and private draft status
- **Research Watch** dashboard: active topics, private source queue, credibility/assessment choices, review/dismiss/reopen decisions, group attribution and deliberately manual promotion to source library
- **Three independent investigation groups**: Epstein Files; COVID-19; and Palestine / Gaza — International Law & Accountability. Each has its own research sections, primary source links, timeline and owner-only add/review actions.

## Current limitations

- Existing cases, claims, sources, people and organizations are editable from **Workspace → Edit existing records**. The app intentionally has no automatic deletion feature.
- A linked citation is not itself verification of a claim.
- Relationship map reflects only explicitly recorded links, not automatically inferred ties.
- Live login, editing and CSV import should be verified manually in a signed-in browser session. Supabase reports the Edge Function deployment active, but a browser end-to-end test is still needed.
- Internet connection required for the Supabase client and backend.

Maintained as a private-data application served from a public-code repository.

## Imported master index and future CSV imports

**Import completed 16 October 2026:** The uploaded *Documented Government Operations Master Index 1-140* was parsed and imported directly into the connected Supabase project. All case numbers 1–140 are accounted for: existing case #1 was kept without rewriting; 139 additional cases are private drafts. The 147 bibliography register entries from three separate source-register namespaces have been inserted and mapped to the 140 cases via 219 documented citations. Source listings and the original 40-page PDF are not independent verification of their contents or link availability.

**Important:** The original working index deliberately retains repeated/cross-referenced case titles and distinguishes documented events, disputed attribution, and unsupported murder/suppression theories. Do not interpret the network map or a case/source link as proof of culpability or causation.

For future collections, the CSV import workflow still works:

In **Workspace → Import a case catalog**, choose a UTF-8 CSV with a `title` header. Supported optional headers: `summary`, `description`, `category`, `country`, `start_date`, `end_date`, `official_finding`, and `disputed_questions`. Dates must use `YYYY-MM-DD`. Review the preview and confirm before writing. Imports will assign new case numbers, skip duplicate titles, and mark every imported case as a private draft pending review. Never import records that have not been fact-checked as verified claims.

The original master PDF is preserved in the user’s uploaded conversation; its contents have been imported into Supabase, not published into this public GitHub repository. Case Files supports case number/title search and shows its exact master-index source citations. Connections Map supports case selection and compares shared source references, without implying collaboration or wrongdoing.

## Daily discovery schedule

A ChatGPT scheduled task named **Evidence Atlas Daily Research** is enabled and configured for daily morning runs in America/Los_Angeles. The 11 active watch topics cover the original historical cases and the three independent investigations; new findings are staged as pending and tagged by group when applicable. It searches active research topics, attempts to deduplicate source URLs, and stages noteworthy results in `research_inbox` under `review_status='pending'`. It may run only while the connected tools remain authorized and the scheduled task is active. It does not automatically create verified claims or publish findings. If a run cannot access Supabase, it should report the blocker instead of claiming records were saved.

**Review new items:** Sign in → **Research Watch** → open sources, update assessment, mark reviewed, and optionally add them to Source Library as private drafts. A reviewed source is not necessarily corroborated; connect it to a claim only after evaluating the source and its limitations.

Two October 2026 reporting articles were seeded into the review inbox as **pending / unassessed** starter research, without linking either to a case. Their inclusion does not establish the assertions in the articles.

## Independent investigation groups (added October 2026)

Evidence Atlas now stores three private investigation workspaces **separately** from the original case number series, without modifying case #1–140 or their bibliography.

1. **Epstein Files**: 5 research sections, official DOJ releases, Inspector General custody report, timeline, and links to the four relevant pre-existing index cases. Use survivor-centered safeguards. Being named in a record is not proof of involvement in crime.
2. **COVID-19**: 5 research sections and WHO sources on origins, epidemiology, mortality, vaccination research, public policies and communications. The WHO SAGO June 2025 assessment says the available evidence favors zoonotic spillover but substantial origin questions remain unresolved. No hypothesis is deemed established solely by inclusion.
3. **Palestine / Gaza**: 7 research sections, UN fact-finding reports, ICJ and ICC dockets, the official Rome Statute, genocide-law definitions, and event chronology. The UN Commission of Inquiry's September 2025 genocide conclusion must be attributed as its investigative finding; Israel disputes it. ICC arrest warrants alleging war crimes and crimes against humanity are not criminal convictions. ICJ provisional measures under the Genocide Convention are not a final merits judgment. The Rome Statute treats crimes against humanity (Article 7), war crimes (Article 8) and genocide (Article 6) as distinct legal categories, with different elements. A conflict itself should not be categorized as a criminal act without examining specific underlying conduct and legal context.

New group records are owner-only by row-level security. The source links and timelines are curated *references* and should not be mistaken for exhaustive or independent verification of every claim. New research enters the private Research Watch queue before owner review. No automatic publication or guilt attribution is performed.

## Verification

- Supabase Edge Function deployment version 8 is reported ACTIVE.
- App inline scripts passed JavaScript syntax validation.
- Supabase owner-role SELECT checks returned the new investigation groups and linked records; simulated non-owner requests saw zero rows in the new group tables. Original 140-case corpus remains intact.
- An independent real-browser end-to-end sign-in/write test has **not** been completed and remains part of release acceptance.
- The security advisor currently reports a warning about leaked-password protection (availability depends on Supabase plan).
