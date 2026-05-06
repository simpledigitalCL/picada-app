-- Server-side gamification rewards to prevent client-side XP tampering.

alter table public.profiles
  add column if not exists points integer not null default 0;

alter table public.profiles
  add column if not exists level integer not null default 1;

create or replace function public.handle_contribution_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_delta integer := 0;
begin
  -- Try common ownership fields without hard-coupling a single schema.
  v_user_id := nullif((to_jsonb(new)->>'user_id'), '')::uuid;
  if v_user_id is null then
    v_user_id := nullif((to_jsonb(new)->>'author_id'), '')::uuid;
  end if;
  if v_user_id is null then
    v_user_id := nullif((to_jsonb(new)->>'created_by'), '')::uuid;
  end if;
  if v_user_id is null then
    return new;
  end if;

  if tg_table_name = 'posts' then
    v_delta := 50;
  elsif tg_table_name = 'reviews' or tg_table_name = 'place_tags' then
    v_delta := 10;
  else
    return new;
  end if;

  update public.profiles
  set
    points = coalesce(points, 0) + v_delta,
    level = floor(sqrt((coalesce(points, 0) + v_delta)::numeric / 100.0))::int + 1,
    updated_at = now()
  where id = v_user_id;

  return new;
end;
$$;

drop trigger if exists trg_handle_contribution_reward_posts on public.posts;
create trigger trg_handle_contribution_reward_posts
after insert on public.posts
for each row
execute function public.handle_contribution_reward();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'reviews'
  ) then
    execute 'drop trigger if exists trg_handle_contribution_reward_reviews on public.reviews';
    execute 'create trigger trg_handle_contribution_reward_reviews after insert on public.reviews for each row execute function public.handle_contribution_reward()';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'place_tags'
  ) then
    execute 'drop trigger if exists trg_handle_contribution_reward_place_tags on public.place_tags';
    execute 'create trigger trg_handle_contribution_reward_place_tags after insert on public.place_tags for each row execute function public.handle_contribution_reward()';
  end if;
end $$;
