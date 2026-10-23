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

-- Status, valores e datas do dashboard ----------------------------------------
-- novo → proposta → esboco → producao → entregue; parado e recusado a qualquer momento.
-- "Aceitou" = passou para esboço, produção, parado ou entregue.
alter table public.briefings drop constraint if exists briefings_status_check;
alter table public.briefings add constraint briefings_status_check
  check (status in ('novo', 'proposta', 'esboco', 'producao', 'parado', 'entregue', 'recusado'));

alter table public.briefings
  add column if not exists valor        numeric(12,2),            -- preço cobrado do cliente
  add column if not exists custo        numeric(12,2),            -- gastos do projeto (domínio, anúncios, terceiros)
  add column if not exists recebido     numeric(12,2) not null default 0,
  add column if not exists aceito_em    timestamptz,              -- quando o cliente fechou
  add column if not exists concluido_em timestamptz,              -- quando foi entregue
  add column if not exists recusado_em  timestamptz;

create or replace function public.marca_status()
returns trigger language plpgsql as $$
begin
  if new.status in ('esboco', 'producao', 'parado', 'entregue') then
    new.aceito_em := coalesce(new.aceito_em, now());
  elsif new.status in ('novo', 'proposta', 'recusado') then
    new.aceito_em := null;
  end if;
  new.concluido_em := case when new.status = 'entregue' then coalesce(new.concluido_em, now()) end;
  new.recusado_em  := case when new.status = 'recusado' then coalesce(new.recusado_em, now()) end;
  return new;
end $$;

drop trigger if exists briefings_status on public.briefings;
create trigger briefings_status before insert or update of status on public.briefings
  for each row execute function public.marca_status();

-- projetos que já estavam andando antes do dashboard
update public.briefings set aceito_em = atualizado_em
  where aceito_em is null and status in ('esboco', 'producao', 'parado', 'entregue');
update public.briefings set concluido_em = atualizado_em
  where concluido_em is null and status = 'entregue';

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

-- Observações ----------------------------------------------------------------
-- Histórico do pedido: cada observação guarda quem escreveu e quando.
create table if not exists public.observacoes (
  id          uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings (id) on delete cascade,
  autor       uuid default auth.uid() references public.equipe (user_id) on delete set null,
  texto       text not null,
  criada_em   timestamptz not null default now()
);
create index if not exists observacoes_briefing on public.observacoes (briefing_id, criada_em);

alter table public.observacoes enable row level security;
revoke all on public.observacoes from anon, authenticated;
grant select, insert, update, delete on public.observacoes to authenticated;

drop policy if exists "equipe cuida das observacoes" on public.observacoes;
create policy "equipe cuida das observacoes" on public.observacoes
  for all to authenticated using (public.is_equipe()) with check (public.is_equipe());

-- Tabela de preços -------------------------------------------------------------
-- Preço de referência de cada serviço; o painel usa para sugerir o valor do pedido.
create table if not exists public.precos (
  servico   text primary key,
  valor     numeric(12,2) not null default 0,
  descricao text not null default '',
  ordem     integer not null default 0
);

insert into public.precos (servico, ordem) values
  ('Landing page', 0), ('Site', 1), ('Instagram', 2), ('Marca e logo', 3)
on conflict (servico) do nothing;

alter table public.precos enable row level security;
revoke all on public.precos from anon, authenticated;
grant select, insert, update, delete on public.precos to authenticated;

drop policy if exists "equipe cuida dos precos" on public.precos;
create policy "equipe cuida dos precos" on public.precos
  for all to authenticated using (public.is_equipe()) with check (public.is_equipe());
