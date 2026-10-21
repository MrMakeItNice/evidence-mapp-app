# Saved news publication

Public page: https://mrmakeitnice.github.io/evidence-mapp-app/discover.html#updates
Repository: MrMakeItNice/evidence-mapp-app
Database project: nxlffnplqdobfqxogmxo

The owner explicitly authorized ongoing publication of significant, sourced news and explained cross-references on 21 October 2026. Routine news writes use Supabase's configured connector and require no website redeployment. Never put a secret key in frontend code. Existing public access is read-only under RLS; only rows explicitly marked published are public.

## Before writing

Read current news_articles and news_historical_connections plus published cases from the public evidence-atlas/api/cases endpoint. Do not expose unpublished cases or private drafts. Compare canonical URLs, event identity, dates and prior summaries to prevent duplicate stories. Read the actual sources; do not reuse a chat summary as verification. Prefer primary records plus original named reporting. If sources are insufficient, leave the item unpublished or wait for stronger evidence.

## Data contract

news_articles has an identity id, unique canonical_url, title, outlet_domain, language, first_seen_at, frame_signals (jsonb), review_status (pending/reviewed/rejected), published (boolean), and collected_at. Use canonical reporting URL when available. Leave review_status pending for AI-assisted checks; never claim a human reviewed it. first_seen_at is the dated event for this legacy feed's ordering; frame_signals.event_date is the displayed event date. Preserve the original record on follow-up; use a new dated item or an explicitly described correction.

frame_signals must contain:

```json
{
  "slug": "stable-event-slug",
  "event_date": "YYYY-MM-DD",
  "category": "Accountability",
  "stage": "Specific procedural or study stage",
  "summary": "Attributed, verified concise account",
  "limits": "Allegations, uncertainty, study limitations, safety and legal status",
  "why": "Practical significance",
  "coverage": "Verifiable comparison, or candid lack of independent comparison",
  "sources": [{"label":"Original report","url":"https://example.org/record","type":"reporting","author":"Named reporter"}],
  "reviewed_at": "YYYY-MM-DD",
  "review_method": "AI-assisted source check; no human review attested"
}
```

Categories: Positive progress, Medical research, Accountability. Source types: primary or reporting. News must contain at least one retrievable source; prefer a primary record and independent reporting when available. For medical items include phase, sample size, comparator, absolute effects when available, safety and approval status. Never infer safety from a missing adverse-event table.

Insert with parameter-safe SQL quoting through the Supabase connector, omitting identity id. Use canonical_url conflict handling and read back the row. Record event-date uncertainty in limits; do not invent dates. Do not overwrite existing records merely because another run found the same story.

## Case connections

news_historical_connections uses identity id, article_id, case_id, connection_type, explanation, supporting_source_url, suggested_by, review_status. Allowed types: topic_overlap, follow_up, primary_record, correction, contradiction, context. For AI links use suggested_by=ai and review_status=proposed. Only link public cases. Explain precisely what connects the story and file, and distinguish a direct development from historical context. Topic overlap never establishes coordination, causation, guilt or a shared operation. Do not force a connection to every item. Conflict key: (article_id,case_id,connection_type).

## Readback and reporting

Read newly written rows and connections, then verify the public anonymous REST API returns the published items. The public reader loads those records on opening, refresh and return to the tab. Its search, category filter and related-case filter work without redeployment. Only report a successful website addition after the persisted and public readback checks succeed. If publication fails, report that limitation and retain sourced findings without claiming they were added. Keep the existing notification threshold; skip notifications if nothing significant changed.

Keep all original evidence, old updates and private research intact. Never modify access policies or source code as part of a routine run. Technical changes are separate from appending news.
