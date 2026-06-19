create extension if not exists pgcrypto;

create table if not exists public.entries (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    predictions jsonb not null,
    submitted_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists entries_name_lower_idx on public.entries (lower(name));

create table if not exists public.results (
    id integer primary key,
    data jsonb not null,
    updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.entries enable row level security;
alter table public.results enable row level security;

drop policy if exists "Permitir lectura pública de entries" on public.entries;
drop policy if exists "Permitir inserción pública de entries" on public.entries;
drop policy if exists "Permitir actualización pública de entries" on public.entries;
drop policy if exists "Permitir borrado público de entries" on public.entries;
drop policy if exists "Permitir lectura pública de results" on public.results;
drop policy if exists "Permitir inserción pública de results" on public.results;
drop policy if exists "Permitir actualización pública de results" on public.results;

create policy "Permitir lectura pública de entries" on public.entries
    for select
    using (true);

create policy "Permitir lectura pública de results" on public.results
    for select
    using (true);

create policy "Permitir inserción pública de results" on public.results
    for insert
    with check (true);

create policy "Permitir actualización pública de results" on public.results
    for update
    using (true)
    with check (true);

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'entries'
    ) then
        alter publication supabase_realtime add table public.entries;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'results'
    ) then
        alter publication supabase_realtime add table public.results;
    end if;
end
$$;
