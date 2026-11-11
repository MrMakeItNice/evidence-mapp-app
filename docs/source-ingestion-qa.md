# Source provenance and ingestion QA (review proposal)

This checklist is **read-only**. It does not approve publication, update evidence grades, or modify the production database.

## Observed audit snapshot — 2026-11-11

- 278 news items; 60 contain Google News proxy links instead of canonical publisher links.
- 40 research-inbox records; 25 URL-equal news/inbox pairs. This is an overlap count, **not** proof of inappropriate duplication: deeper case investigation can justify both records.
- No exact duplicate URL groups within news items (case-insensitive trim comparison).
- 285 source records; one lacks a direct URL. A missing URL is a provenance-review flag, not proof that the source is invalid.
- 36 active news topics and 11 active research watch topics.

Counts are a point-in-time snapshot, not a live dashboard.

## Proposed safe ingestion workflow

1. Preserve the feed URL exactly as received in an audit trail; never silently replace it.
2. Resolve Google News redirects server-side with bounded redirects, timeouts, and SSRF protections. Only permit HTTP(S), reject private/local network destinations, and do not fetch authenticated or restricted resources.
3. Extract and inspect the publisher canonical URL; verify that the destination actually represents the same article, not merely the publisher homepage. Keep the original URL when resolution fails and flag for review.
4. Normalize only safe URL properties for matching (host casing, default ports, trailing fragments, known tracking parameters). Preserve article IDs, path casing, and meaningful query parameters. Never merge solely on matching titles.
5. Check candidate canonical URLs against **both** news and research inbox; flag overlap rather than deleting either record. Human review determines whether a deeper case-specific inbox entry is justified.
6. Store provenance for the original link, resolved destination, publisher, retrieval time, publication-date evidence, and any uncertainty. Do not infer dates from feed discovery timestamps.
7. Treat RSS as leads, not verified evidence. Publication and changes to evidence assessments remain separate owner-review decisions.

## Read-only audit SQL

```sql
SELECT count(*) AS proxy_link_news_items
FROM public.news_items
WHERE source_url ILIKE '%news.google.com%';

SELECT lower(trim(source_url)) AS normalized_url, count(*) AS occurrences
FROM public.news_items
WHERE source_url IS NOT NULL
GROUP BY 1 HAVING count(*) > 1;

SELECT count(*) AS exact_cross_queue_url_matches
FROM public.research_inbox i
JOIN public.news_items n
  ON lower(trim(i.source_url)) = lower(trim(n.source_url));

SELECT id, title, publisher, publication_date
FROM public.sources
WHERE nullif(trim(url), '') IS NULL;
```

## Acceptance criteria for a future implementation

- Tests cover redirected links, unchanged links, broken links, malicious redirects, same-title/different-article cases, and tracking parameters.
- No production writes or publication in test mode; proposed canonical mappings are reviewed before applying.
- No change to evidence grades, review status, or existing source attribution without explicit owner review.
- A failed resolution does not erase the original source URL.
