-- Schema voor de gedeelde activiteiten: voorstellen, duimpjes en ieders
-- prioriteit. Plak dit in Supabase → SQL Editor en draai het één keer. Het is
-- herhaalbaar: opnieuw draaien laat bestaande data staan.
--
-- Rechtenmodel:
--   - Iedereen met de link mag alles lezen, ook zonder in te loggen.
--   - Schrijven mag alleen wie lid is: een rij in `profiles`. Die rij ontstaat
--     uitsluitend via join_group(), dat de groepscode controleert. Clients
--     kunnen `profiles` niet zelf aanvullen.
--   - Je past alleen je eigen voorstellen en reacties aan.
--
-- De groepscode zelf staat niet in dit bestand (de repo is te lezen); die zet
-- je los, zie onderaan.

-- ── Groepscode, buiten de API ─────────────────────────────────────────────
-- Het schema `private` hangt niet in de Data API, dus geen client kan hier
-- lezen. Alleen join_group() (security definer) kijkt erin.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.group_code (
  code text primary key
);

-- ── Leden ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  username text not null check (char_length(username) between 1 and 30),
  created_at timestamptz not null default now()
);

-- ── Voorgestelde activiteiten ─────────────────────────────────────────────
-- stop_id verwijst naar stops[].id in content/trip.json. Geen foreign key: de
-- stops leven in git, niet in de database.
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  stop_id text not null check (char_length(stop_id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  url text check (char_length(url) <= 500 and url ~ '^https?://'),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists suggestions_stop_id_idx on public.suggestions (stop_id);

-- ── Reacties: duimpje en eigen prioriteit ─────────────────────────────────
-- Eén rij per persoon per activiteit. activity_key is ofwel
-- 'trip:<stopId>/<activityId>' voor een activiteit uit trip.json, ofwel
-- 'suggestion:<uuid>' voor een voorstel. Zo werken duimpjes en prioriteiten op
-- beide zonder twee tabellen.
create table if not exists public.reactions (
  activity_key text not null check (activity_key ~ '^(trip|suggestion):.+$'),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  thumbs_up boolean not null default false,
  priority text check (priority in ('must', 'nice', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (activity_key, user_id)
);

-- Verwijder je een voorstel, dan gaan de reacties erop mee. Een foreign key
-- kan dat niet, omdat activity_key ook naar trip.json kan wijzen.
create or replace function private.delete_suggestion_reactions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reactions where activity_key = 'suggestion:' || old.id;
  return old;
end;
$$;

drop trigger if exists suggestions_delete_reactions on public.suggestions;
create trigger suggestions_delete_reactions
  after delete on public.suggestions
  for each row execute function private.delete_suggestion_reactions();

-- ── Lid worden ────────────────────────────────────────────────────────────
-- Vraagt een (anoniem) ingelogde gebruiker om de groepscode en een naam. Klopt
-- de code, dan komt er een profiel; nogmaals aanroepen wijzigt alleen de naam.
create or replace function public.join_group(p_code text, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;
  if not exists (select 1 from private.group_code where code = p_code) then
    raise exception 'Onjuiste groepscode' using errcode = '28000';
  end if;
  insert into public.profiles (user_id, username)
  values (auth.uid(), trim(p_username))
  on conflict (user_id) do update set username = excluded.username;
end;
$$;

revoke execute on function public.join_group(text, text) from public, anon;
grant execute on function public.join_group(text, text) to authenticated;

-- ── Rechten ───────────────────────────────────────────────────────────────
-- Expliciet, zodat het niet afhangt van de instelling "automatically expose
-- new tables" van het project. RLS hieronder beperkt wat er echt mag.
grant select on public.profiles, public.suggestions, public.reactions to anon, authenticated;
grant update (username) on public.profiles to authenticated;
grant insert, update, delete on public.suggestions, public.reactions to authenticated;

alter table public.profiles enable row level security;
alter table public.suggestions enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "Iedereen leest profielen" on public.profiles;
create policy "Iedereen leest profielen" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "Eigen naam wijzigen" on public.profiles;
create policy "Eigen naam wijzigen" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Iedereen leest voorstellen" on public.suggestions;
create policy "Iedereen leest voorstellen" on public.suggestions
  for select to anon, authenticated using (true);

-- De foreign key naar profiles maakt "is lid" al verplicht: zonder profiel
-- faalt de insert.
drop policy if exists "Leden plaatsen voorstellen" on public.suggestions;
create policy "Leden plaatsen voorstellen" on public.suggestions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Eigen voorstel wijzigen" on public.suggestions;
create policy "Eigen voorstel wijzigen" on public.suggestions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Eigen voorstel verwijderen" on public.suggestions;
create policy "Eigen voorstel verwijderen" on public.suggestions
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Iedereen leest reacties" on public.reactions;
create policy "Iedereen leest reacties" on public.reactions
  for select to anon, authenticated using (true);

drop policy if exists "Leden reageren" on public.reactions;
create policy "Leden reageren" on public.reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Eigen reactie wijzigen" on public.reactions;
create policy "Eigen reactie wijzigen" on public.reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Eigen reactie verwijderen" on public.reactions;
create policy "Eigen reactie verwijderen" on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── Groepscode zetten (los draaien, niet committen) ───────────────────────
--   delete from private.group_code;
--   insert into private.group_code (code) values ('jouw-code-hier');
