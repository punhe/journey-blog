-- View counts for the blog, read and written by api/views.ts.
create table if not exists public.post_views (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,120}$'),
  views bigint not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);

-- RLS on and no policies: the anon and authenticated keys see nothing.
-- The functions use the secret key, which bypasses RLS.
alter table public.post_views enable row level security;

-- One upsert, so two overlapping visits never lose a count.
create or replace function public.increment_post_view(p_slug text)
returns bigint
language sql
set search_path = ''
as $$
  insert into public.post_views as pv (slug, views)
  values (p_slug, 1)
  on conflict (slug) do update
    set views = pv.views + 1, updated_at = now()
  returning pv.views;
$$;

revoke execute on function public.increment_post_view(text) from public, anon, authenticated;
grant execute on function public.increment_post_view(text) to service_role;
