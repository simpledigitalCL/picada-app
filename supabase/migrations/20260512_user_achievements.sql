-- Persistent achievement progress per authenticated user.
-- Replaces the localStorage-only approach so that progress survives
-- cache clears, device switches, and the Capacitor WebView being wiped.

create table if not exists public.user_achievements (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  challenge_id  text        not null,
  count         integer     not null default 0,
  discovery_shown boolean   not null default false,
  reward_shown  boolean     not null default false,
  unlocked_at   timestamptz,
  is_featured   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, challenge_id)
);

alter table public.user_achievements enable row level security;

create policy "users read own achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

create policy "users insert own achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

create policy "users update own achievements"
  on public.user_achievements for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
