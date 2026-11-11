# Evidence Atlas — Research review checklist

This is an editorial protocol, not an automated verification system. Imported headlines, search hits, and agent outputs are **leads** until reviewed.

## Review each record
1. Preserve original URL, publisher, author, publication date, retrieval time, and a stable identifier where available.
2. Open the primary source. Record what it actually says, with a precise quotation or page/section locator; distinguish a source's assertion from independently established fact.
3. Check whether the item duplicates an existing source, is a syndicated copy, or merely cites the same underlying report.
4. Separate **documented observation**, **source allegation**, **interpretation**, **hypothesis**, and **unknown**. Record counterevidence and plausible alternative explanations.
5. Link a claim to its supporting and contradicting sources; do not infer causation, coordination, or wrongdoing from a shared person, date, funding link, or keyword.
6. Record the reviewer, date, decision, reason, unresolved questions, and follow-up. Recheck changed or retracted sources.

## Publication gate
- **Pending:** collected, not assessed. Never display as verified.
- **Needs corroboration:** relevant lead, but original source, context, or independent support is missing.
- **Reviewed with limitations:** reviewed provenance and evidence; show caveats and disagreements alongside the claim.
- **Rejected/duplicate:** do not promote; retain an audit trail.

These labels are proposed editorial vocabulary; they are **not** claims about existing database enum values or implemented UI workflows. Implement only after checking the actual schema, RLS policies, and reviewer permissions.

## Implementation acceptance tests
- A pending news item cannot silently become a verified case claim.
- Every displayed factual claim has traceable source references and a visible review state.
- Contradictory evidence and corrections remain visible.
- Review actions require authorized users and create an audit trail.
- Search and collector errors display honestly instead of being treated as zero results.
