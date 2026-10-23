-- MakeMyCV feedback tables (2026-10-24): ratings + quotes, email sign-ups.
-- Apply once to the Supabase project named in SUPABASE_URL (EU region).
-- Both tables: RLS on, NO policies. The anon/publishable key can touch
-- nothing; only the service-role key used by app.makemycv.ae/api/* can.

create extension if not exists citext;

create table if not exists public.ratings (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  stars            smallint not null check (stars between 1 and 5),
  surface          text not null check (surface in ('post_export', 'post_checker', 'cover_letter')),
  country          text,                       -- ISO 3166-1 alpha-2 from the edge, nothing finer
  quote            text check (char_length(quote) <= 280),
  quote_consent    boolean not null default false,
  display_name     text check (char_length(display_name) <= 40),
  display_role     text check (char_length(display_role) <= 60),
  edit_token_hash  text,                       -- sha256 of the one-time follow-up token (24h)
  approved_at      timestamptz,                -- set BY HAND in the dashboard; never by code
  approved_note    text
);
create index if not exists ratings_created_at_idx on public.ratings (created_at desc);
create index if not exists ratings_approved_idx on public.ratings (approved_at) where approved_at is not null;

create table if not exists public.subscribers (
  id                  uuid primary key default gen_random_uuid(),
  email               citext not null unique,
  created_at          timestamptz not null default now(),
  source              text not null,
  consent_text_version text not null,
  country             text,
  confirm_token_hash  text,
  confirm_sent_at     timestamptz,
  confirmed_at        timestamptz,
  unsubscribe_token   text unique,             -- raw: it has to be printed into every email
  unsubscribed_at     timestamptz
);
create index if not exists subscribers_confirmed_idx on public.subscribers (confirmed_at) where confirmed_at is not null and unsubscribed_at is null;

alter table public.ratings enable row level security;
alter table public.subscribers enable row level security;

-- Belt and braces: even if a policy is ever added by mistake, anon gets nothing.
revoke all on public.ratings from anon, authenticated;
revoke all on public.subscribers from anon, authenticated;
