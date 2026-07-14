-- v26 地点库迁移：地点独立管理，并允许展览引用或覆盖地点坐标
begin;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  address text default '',
  longitude double precision,
  latitude double precision,
  notes text default '',
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.venues enable row level security;
drop policy if exists "venues are public" on public.venues;
create policy "venues are public" on public.venues for select to anon, authenticated using (true);
drop policy if exists "authenticated users manage venues" on public.venues;
create policy "authenticated users manage venues" on public.venues for all to authenticated using (true) with check (true);

alter table public.assets add column if not exists venue_id uuid references public.venues(id) on update cascade on delete restrict;
alter table public.assets add column if not exists use_venue_coordinates boolean not null default true;

-- 将现有地点文本一次性导入地点库，并用现有展览坐标作为地点初始坐标。
insert into public.venues(name, longitude, latitude, sort_order)
select venue, max(longitude), max(latitude), row_number() over(order by venue)::integer
from public.assets
where nullif(trim(venue),'') is not null
group by venue
on conflict(name) do update set
  longitude = coalesce(public.venues.longitude, excluded.longitude),
  latitude = coalesce(public.venues.latitude, excluded.latitude);

update public.assets a
set venue_id = v.id
from public.venues v
where a.venue_id is null and trim(a.venue) = trim(v.name);

create index if not exists assets_venue_id_idx on public.assets(venue_id);
create index if not exists venues_name_idx on public.venues(name);

commit;
