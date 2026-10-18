create table if not exists public.document_translations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 title text not null check(length(btrim(title)) between 1 and 200),
 original_filename text,
 original_sha256 text not null check(original_sha256 ~ '^[a-f0-9]{64}$'),
 source_language text not null check(length(source_language) between 2 and 12),
 target_language text not null default 'en' check(length(target_language) between 2 and 12),
 original_text text not null check(length(original_text) between 1 and 100000),
 translated_text text not null check(length(translated_text) between 1 and 100000),
 engine text not null check(engine in ('browser','deepl','manual')),
 review_status text not null default 'pending' check(review_status in ('pending','reviewed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.document_translations enable row level security;
revoke all on public.document_translations from anon;
grant select,insert,update on public.document_translations to authenticated;
create policy owner_translation_read on public.document_translations for select to authenticated using(owner_id=(select auth.uid()) and owner_id='cdfff424-d750-4f82-baa3-d17a6113af53'::uuid);
create policy owner_translation_insert on public.document_translations for insert to authenticated with check(owner_id=(select auth.uid()) and owner_id='cdfff424-d750-4f82-baa3-d17a6113af53'::uuid);
create policy owner_translation_update on public.document_translations for update to authenticated using(owner_id=(select auth.uid()) and owner_id='cdfff424-d750-4f82-baa3-d17a6113af53'::uuid) with check(owner_id=(select auth.uid()) and owner_id='cdfff424-d750-4f82-baa3-d17a6113af53'::uuid);
create index document_translations_owner_created on public.document_translations(owner_id,created_at desc);
