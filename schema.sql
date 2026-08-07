-- Rode isto no SQL Editor do seu projeto Supabase (Supabase > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  unique (user_id, habit_id, date)
);

create table if not exists profiles (
  user_id text primary key,
  nickname text,
  streak integer not null default 0,
  reminder_time text default '20:00',
  notify_enabled boolean default false,
  updated_at timestamptz not null default now()
);

-- Habilita Row Level Security
alter table habits enable row level security;
alter table checkins enable row level security;
alter table profiles enable row level security;

-- IMPORTANTE: como este projeto não tem login/senha, qualquer pessoa com a
-- chave pública (anon key) consegue ler e escrever nessas tabelas. Isso é
-- aceitável para um projeto pessoal/MVP, mas não use para dados sensíveis.
-- Se quiser mais segurança depois, adicione Supabase Auth e troque estas
-- políticas por "user_id = auth.uid()".

create policy "permitir tudo em habits" on habits
  for all using (true) with check (true);

create policy "permitir tudo em checkins" on checkins
  for all using (true) with check (true);

create policy "permitir tudo em profiles" on profiles
  for all using (true) with check (true);
