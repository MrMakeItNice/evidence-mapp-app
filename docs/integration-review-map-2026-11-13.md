# Evidence Atlas integration review map (2026-11-13)

This is a **review aid**, not a release authorization. Do not merge draft PRs blindly.

## Highest-priority gate

- [ ] [#43](https://github.com/MrMakeItNice/evidence-mapp-app/issues/43): decide claim-level publication policy; verify effective anonymous reads in staging and add owner/anonymous RLS tests **before** exposing more claims. Do not change production RLS automatically.
- [ ] [#57](https://github.com/MrMakeItNice/evidence-mapp-app/issues/57): consolidate public navigation, provenance, globe, magazine, and Evidence Board with release QA.

## Overlap requiring manual consolidation

| Area | Draft PRs | Review action |
| --- | --- | --- |
| Evidence Board source URL safety | [#53](https://github.com/MrMakeItNice/evidence-mapp-app/pull/53), [#64](https://github.com/MrMakeItNice/evidence-mapp-app/pull/64) | Compare validators and tests; choose one canonical implementation. |
| Evidence Board keyboard movement | [#49](https://github.com/MrMakeItNice/evidence-mapp-app/pull/49), [#52](https://github.com/MrMakeItNice/evidence-mapp-app/pull/52) | Compare step sizes and key handling; avoid merging both without reconciliation. |
| Evidence Board provenance semantics | [#51](https://github.com/MrMakeItNice/evidence-mapp-app/pull/51), [#55](https://github.com/MrMakeItNice/evidence-mapp-app/pull/55), [#56](https://github.com/MrMakeItNice/evidence-mapp-app/pull/56) | Combine citation-only warning, missing metadata, and source role without implying verification. |
| Release tests | [#40](https://github.com/MrMakeItNice/evidence-mapp-app/pull/40), [#65](https://github.com/MrMakeItNice/evidence-mapp-app/pull/65) | Ensure test runner includes new tests and CI is actually green. |
| Mobile and accessibility | [#50](https://github.com/MrMakeItNice/evidence-mapp-app/pull/50), [#59](https://github.com/MrMakeItNice/evidence-mapp-app/pull/59), [#62](https://github.com/MrMakeItNice/evidence-mapp-app/pull/62), [#63](https://github.com/MrMakeItNice/evidence-mapp-app/pull/63) | Run browser/mobile/keyboard tests on combined integration branch. |

## Minimum acceptance checks

1. Run `node --test tests/*.test.cjs tests/*.test.mjs` after bringing candidate test files together; investigate failures rather than assuming all patterns exist on main.
2. Inspect all source links for HTTP(S) validity, provenance labels, and safe external opening.
3. Confirm graph edges distinguish citation from corroboration, causation, and culpability.
4. Test phone viewport, keyboard navigation, focus visibility, globe performance, and no-JS/error states.
5. Verify public vs owner access in staging, with no production writes.
6. Obtain explicit approval before merging or deploying.

Status: review checklist only. **No tests or browser checks were executed to create this document.**
