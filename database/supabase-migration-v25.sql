-- v25 资产控制台迁移：删除旧静态坐标，新增权重与区域管理
begin;

alter table public.assets add column if not exists exhibition_weight text;
alter table public.assets drop constraint if exists assets_exhibition_weight_check;
alter table public.assets add constraint assets_exhibition_weight_check
  check (exhibition_weight is null or exhibition_weight in ('A','B','C','D'));

alter table public.assets drop column if exists pin_x;
alter table public.assets drop column if exists pin_y;
alter table public.assets drop column if exists object_left;
alter table public.assets drop column if exists object_top;
alter table public.assets drop column if exists object_width;

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  center_longitude double precision not null,
  center_latitude double precision not null,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.regions(name,center_longitude,center_latitude,sort_order) values
('外滩',121.49185,31.24055,1),
('苏州河',121.49390,31.27500,2),
('世博园',121.49370,31.19420,3),
('徐汇滨江',121.46080,31.19360,4)
on conflict(name) do nothing;

alter table public.regions enable row level security;
drop policy if exists "regions are public" on public.regions;
create policy "regions are public" on public.regions for select to anon, authenticated using (true);
drop policy if exists "authenticated users manage regions" on public.regions;
create policy "authenticated users manage regions" on public.regions for all to authenticated using (true) with check (true);

commit;
