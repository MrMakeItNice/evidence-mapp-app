# Evidence Atlas

A source-grounded research workspace for case files, claims, source references, people, organizations, connection maps, timelines, and modeled outcomes. This repo hosts the static browser frontend; the existing Supabase project stores the research records.

## Live app (Supabase Edge Functions)

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
- Case, people, organization and source library
- Source-linked claims and evidence status filters
- Schematic relationship map (links ≠ causation)
- Date-based timeline
- Draft solution proposals and modeled possible outcomes
- Owner-protected record creation, editing, and JSON export
- Owner-only CSV case catalog import with a preview, duplicate-title skipping, and private draft status

## Current limitations

- Existing cases, claims, sources, people and organizations are editable from **Workspace → Edit existing records**. The app intentionally has no automatic deletion feature.
- A linked citation is not itself verification of a claim.
- Relationship map reflects only explicitly recorded links, not automatically inferred ties.
- Live login, editing and CSV import should be verified manually in a signed-in browser session. Supabase reports the Edge Function deployment active, but a browser end-to-end test is still needed.
- Internet connection required for the Supabase client and backend.

Maintained as a private-data application served from a public-code repository.

## Import the larger case catalog

In **Workspace → Import a case catalog**, choose a UTF-8 CSV with a `title` header. Supported optional headers: `summary`, `description`, `category`, `country`, `start_date`, `end_date`, `official_finding`, and `disputed_questions`. Dates must use `YYYY-MM-DD`. Review the preview and confirm before writing. Imports will assign new case numbers, skip duplicate titles, and mark every imported case as a private draft pending review. Never import records that have not been fact-checked as verified claims.

The complete 120–140+ historical case corpus is not stored in this repo or Supabase yet; obtain the original master research material before importing, rather than generating purported findings from memory.
