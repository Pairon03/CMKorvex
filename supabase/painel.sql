-- Painel interno da Korvex (vmkorvex.vercel.app/painel).
-- Rodar depois do briefing.sql: SQL Editor → New query → colar tudo → Run.
-- Pode rodar de novo quantas vezes precisar; nada é apagado.
--
-- Antes de rodar, crie os logins em Authentication → Users → Add user → Create new user
-- (marque "Auto Confirm User"). Todo usuário que existir no Auth na hora em que este
-- arquivo roda entra na equipe. Quem for criado depois só entra rodando de novo.

-- Equipe -------------------------------------------------------------------
-- Só quem está nesta tabela vê alguma coisa no painel. Um login qualquer, sem
-- estar aqui, não lê nem muda nada.
create table if not exists public.equipe (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,                       -- dá para trocar no painel (menu do topo)
  visto_em  timestamptz not null default now()   -- para o aviso de briefing novo
);

insert into public.equipe (user_id, nome)
select id, initcap(trim(regexp_replace(split_part(email, '@', 1), '[._0-9-]+', ' ', 'g'))) from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_equipe()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.equipe where user_id = auth.uid()) $$;

revoke all on function public.is_equipe() from public, anon;
grant execute on function public.is_equipe() to authenticated;

alter table public.equipe enable row level security;
revoke all on public.equipe from anon, authenticated;
grant select on public.equipe to authenticated;
grant update (nome, visto_em) on public.equipe to authenticated;

drop policy if exists "equipe se ve" on public.equipe;
create policy "equipe se ve" on public.equipe
  for select to authenticated using (public.is_equipe());

drop policy if exists "cada um atualiza o seu" on public.equipe;
create policy "cada um atualiza o seu" on public.equipe
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Briefings: campos do painel ------------------------------------------------
alter table public.briefings
  add column if not exists origem        text not null default 'briefing',  -- 'briefing' ou 'manual'
  add column if not exists notas         text not null default '',
  add column if not exists prazo         date,
  add column if not exists atualizado_em timestamptz not null default now();

-- projetos cadastrados à mão não têm respostas do formulário
alter table public.briefings alter column resumo    set default '[]'::jsonb;
alter table public.briefings alter column respostas set default '{}'::jsonb;

create or replace function public.marca_atualizacao()
returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

drop trigger if exists briefings_atualizado on public.briefings;
create trigger briefings_atualizado before update on public.briefings
  for each row execute function public.marca_atualizacao();

-- Acesso da equipe (substitui o acesso aberto a qualquer login do briefing.sql)
revoke all on public.briefings from authenticated;
grant select, insert, update, delete on public.briefings to authenticated;

drop policy if exists "equipe le briefings" on public.briefings;
drop policy if exists "equipe atualiza briefings" on public.briefings;
drop policy if exists "equipe cuida dos briefings" on public.briefings;
create policy "equipe cuida dos briefings" on public.briefings
  for all to authenticated using (public.is_equipe()) with check (public.is_equipe());

-- Tarefas --------------------------------------------------------------------
create table if not exists public.tarefas (
  id          uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings (id) on delete cascade,
  titulo      text not null,
  feita       boolean not null default false,
  ordem       integer not null default 0,
  criada_em   timestamptz not null default now()
);
create index if not exists tarefas_briefing on public.tarefas (briefing_id, ordem);

alter table public.tarefas enable row level security;
revoke all on public.tarefas from anon, authenticated;
grant select, insert, update, delete on public.tarefas to authenticated;

drop policy if exists "equipe cuida das tarefas" on public.tarefas;
create policy "equipe cuida das tarefas" on public.tarefas
  for all to authenticated using (public.is_equipe()) with check (public.is_equipe());

-- Fotos ----------------------------------------------------------------------
drop policy if exists "equipe ve fotos" on storage.objects;
create policy "equipe ve fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'briefings' and public.is_equipe());

drop policy if exists "equipe apaga fotos" on storage.objects;
create policy "equipe apaga fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'briefings' and public.is_equipe());
