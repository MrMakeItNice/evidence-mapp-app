# Ask Evidence: activation and current status

Checked November 15, 2026 against the live website and Supabase backend.

## Available now

- The published-source finder is deployed at `evidence-chat` and returns published case summaries and source links. It does not generate an AI answer unless the visitor opts in and the provider is configured.
- The existing database budget is installed, uses an atomic counter, and is accessible only to the backend service role. Its default is **30 attempted AI requests per UTC day for the entire site**, not per visitor. Failed provider requests after reservation still count.
- The floating assistant is included on the homepage, public reader, owner workspace and Healing page. The public reader supports `discover.html#ask-evidence` to open the assistant directly.
- Questions and responses stay in page memory. There is no chat-history database. AI-enabled requests send the current question and selected published excerpts to OpenAI with `store:false`; this does not mean zero provider retention.
- Natural-language topic searches ignore generic research wording rather than pulling unrelated cases into the citation list. The regression check is `node tests/evidence-research.mjs`.

**AI answer activation is pending.** The live status check returns `ai_available:false`. Source-finder results must not be described as live AI-generated answers. No successful paid-provider answer has been verified.

## Activate the existing backend

1. Connect an OpenAI API account. Use an API project key for this website. An eligible Pro account can claim subscription API credits by linking an API organization; Pro is not required to purchase API usage separately. Never paste a secret key into a chat, frontend file, URL, or GitHub repository.
2. In the existing Supabase project's **Edge Functions → Secrets**, configure `OPENAI_API_KEY` and `EVIDENCE_AI_PUBLIC_ENABLED=true`. Keep `EVIDENCE_AI_DAILY_LIMIT=30` for the initial test. `EVIDENCE_AI_MODEL` currently defaults to `gpt-4.1-mini`; use a supported model with Responses API and Structured Outputs compatibility if changing it. The key belongs in server-side secrets only.
3. Check `GET /functions/v1/evidence-chat` for `ai_available:true`, then use the website's explicit AI checkbox to ask about a published topic. Confirm a real response has `mode:ai_answer`, `ai_generation:true`, relevant citation IDs, and working links. An available flag alone does not verify a valid key, credit balance, model access, or successful generation.

The current connector can inspect and deploy Edge Functions but cannot set their secrets. Connecting the OpenAI API account does not by itself install a key in Supabase. Use the secure provider-setup flow when available and the Supabase secrets screen for the server configuration.

## Before calling the feature live

- Run `node tests/web-checks.mjs`. Its provider responses are mocked: passing does not establish paid-provider access.
- Verify public search works without AI consent and sends no request to OpenAI.
- Verify opt-in AI returns a cited answer and identifies insufficient evidence rather than filling gaps.
- Verify missing credentials, exhausted daily allowance, provider failure, malformed/incomplete output and unknown citation IDs fall back to source search.
- Check the homepage and reader on a narrow screen. Existing globe controls and the welcome introduction must continue to work.

API credits are a dollar balance that pays for API usage, separate from ChatGPT messages. Costs depend on the chosen model, input/output tokens and tools. The request counter limits frequency; it is not a dollar spending cap. An empty API balance prevents generation unless other billing is configured. Hosting and other service charges are separate.

Official references:

- https://developers.openai.com/api/docs/guides/chatgpt-api-credits
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/overview
- https://supabase.com/docs/guides/functions/secrets
