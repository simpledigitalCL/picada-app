create table if not exists public.user_tag_affinity (
  user_id uuid not null,
  tag_slug text not null,
  weight integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tag_slug)
);

create index if not exists idx_user_tag_affinity_user
  on public.user_tag_affinity(user_id);

create index if not exists idx_user_tag_affinity_weight
  on public.user_tag_affinity(weight desc);

alter table public.user_tag_affinity enable row level security;

drop policy if exists "user_tag_affinity_read_own" on public.user_tag_affinity;
create policy "user_tag_affinity_read_own"
on public.user_tag_affinity
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_tag_affinity_insert_own" on public.user_tag_affinity;
create policy "user_tag_affinity_insert_own"
on public.user_tag_affinity
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_tag_affinity_update_own" on public.user_tag_affinity;
create policy "user_tag_affinity_update_own"
on public.user_tag_affinity
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

