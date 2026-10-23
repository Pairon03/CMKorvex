-- Briefings de clientes da Korvex.
-- Rodar uma vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Visitantes (anon) só conseguem ENVIAR um briefing e as fotos dele.
-- Ninguém de fora consegue ler, mudar ou apagar nada.

-- Tabela ------------------------------------------------------------------
create table if not exists public.briefings (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  status      text not null default 'novo'
              check (status in ('novo', 'esboco', 'producao', 'entregue')),
  nome        text not null,
  empresa     text not null,
  whatsapp    text not null,
  email       text,
  servicos    text[] not null default '{}',
  resumo      jsonb not null,            -- blocos como aparecem na revisão
  respostas   jsonb not null,            -- todas as respostas, campo a campo
  logo        text,                      -- caminho no bucket "briefings"
  fotos       text[] not null default '{}'
);

alter table public.briefings enable row level security;

-- O formulário só insere; sem select, update ou delete para anon.
revoke all on public.briefings from anon, authenticated;
grant insert on public.briefings to anon;

drop policy if exists "formulario envia briefing" on public.briefings;
create policy "formulario envia briefing" on public.briefings
  for insert to anon
  with check (status = 'novo');

-- O acesso da equipe (painel) fica em supabase/painel.sql. Se rodar este arquivo
-- de novo, rode o painel.sql logo depois.

-- Fotos ---------------------------------------------------------------------
-- Bucket privado: só imagens, até 10 MB cada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefings', 'briefings', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "formulario envia fotos" on storage.objects;
create policy "formulario envia fotos" on storage.objects
  for insert to anon
  with check (bucket_id = 'briefings');
