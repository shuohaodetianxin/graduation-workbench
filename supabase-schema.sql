-- ============================================================
-- 加油毕业工作台 · Supabase 建表脚本
-- 使用方法：登录 Supabase → 左侧 SQL Editor → 粘贴本文件全部内容 → Run
-- ============================================================

-- 1) 建表（15 张表，结构统一：id + data(jsonb) + updated_at）
create table if not exists public.exp_tinball_color (
  id text primary key,
  data jsonb,
  updated_at timestamptz
);
create table if not exists public.exp_tinball_clear (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.exp_tinpaste_color (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.exp_tinpaste_clear (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.exp_materials (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.patent_library (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.patent_innovation (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.patent_progress (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_study (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_companies (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_resume (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_fair (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.paper_progress (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.tags (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.settings (
  id text primary key, data jsonb, updated_at timestamptz);

-- 2) 开启行级安全 + 允许匿名读写
--    （仅供个人使用；多人/生产环境请改用更严格的 RLS 策略）
alter table public.exp_tinball_color  enable row level security;
alter table public.exp_tinball_clear  enable row level security;
alter table public.exp_tinpaste_color enable row level security;
alter table public.exp_tinpaste_clear enable row level security;
alter table public.exp_materials      enable row level security;
alter table public.patent_library     enable row level security;
alter table public.patent_innovation  enable row level security;
alter table public.patent_progress    enable row level security;
alter table public.job_study          enable row level security;
alter table public.job_companies      enable row level security;
alter table public.job_resume         enable row level security;
alter table public.job_fair           enable row level security;
alter table public.paper_progress     enable row level security;
alter table public.tags               enable row level security;
alter table public.settings           enable row level security;

create policy "anon all" on public.exp_tinball_color  for all using (true) with check (true);
create policy "anon all" on public.exp_tinball_clear  for all using (true) with check (true);
create policy "anon all" on public.exp_tinpaste_color for all using (true) with check (true);
create policy "anon all" on public.exp_tinpaste_clear for all using (true) with check (true);
create policy "anon all" on public.exp_materials      for all using (true) with check (true);
create policy "anon all" on public.patent_library     for all using (true) with check (true);
create policy "anon all" on public.patent_innovation  for all using (true) with check (true);
create policy "anon all" on public.patent_progress    for all using (true) with check (true);
create policy "anon all" on public.job_study          for all using (true) with check (true);
create policy "anon all" on public.job_companies      for all using (true) with check (true);
create policy "anon all" on public.job_resume         for all using (true) with check (true);
create policy "anon all" on public.job_fair           for all using (true) with check (true);
create policy "anon all" on public.paper_progress     for all using (true) with check (true);
create policy "anon all" on public.tags               for all using (true) with check (true);
create policy "anon all" on public.settings           for all using (true) with check (true);
