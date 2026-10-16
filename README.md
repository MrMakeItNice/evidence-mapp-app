# Evidence Atlas

A source-grounded research workspace for case files, claims, source references, people, organizations, connection maps, timelines, and modeled outcomes. This repo hosts the static browser frontend; the existing Supabase project stores the research records.

## Run it online using GitHub Pages

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
- Owner-protected record creation and JSON export

## Current limitations

- No editing/deletion of existing records from the UI yet.
- A linked citation is not itself verification of a claim.
- Relationship map reflects only explicitly recorded links, not automatically inferred ties.
- Live login and writes must be tested in the browser after Pages is enabled.
- Internet connection required for the Supabase client and backend.

Maintained as a private-data application served from a public-code repository.
