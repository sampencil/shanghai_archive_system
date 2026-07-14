-- 上海城中物志：首次初始化（在 Supabase SQL Editor 中执行一次）
create extension if not exists pgcrypto;
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  system_id text unique not null,
  region text not null default '外滩',
  exhibition_title text not null,
  venue text not null,
  venue_id uuid,
  use_venue_coordinates boolean not null default true,
  object_name text not null,
  start_date date not null,
  end_date date not null,
  image_url text not null,
  longitude double precision,
  latitude double precision,
  exhibition_weight text check (exhibition_weight is null or exhibition_weight in ('A','B','C','D')),
  description text default '',
  status text not null default 'draft' check (status in ('draft','published')),
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.assets enable row level security;
drop policy if exists "published assets are public" on public.assets;
create policy "published assets are public" on public.assets for select to anon, authenticated using (status='published' or auth.role()='authenticated');
drop policy if exists "authenticated users manage assets" on public.assets;
create policy "authenticated users manage assets" on public.assets for all to authenticated using (true) with check (true);

insert into public.assets(system_id,region,exhibition_title,venue,object_name,start_date,end_date,image_url,longitude,latitude,status,sort_order)
values
('art-001','外滩','邱加：如何让物站起来','洞–当代艺术平台','黑色扬声器塔装置','2026-05-06','2026-05-24','assets/images/image-4aaf03f0aa2c.webp',121.4899,31.2406,'published',1),
('art-002','苏州河','再构：时间的编织—大舍建筑展','同济大学建筑与城市规划学院','弧形文字影像屏','2026-06-11','2026-06-14','assets/images/image-cf08eafa4937.webp',121.5072,31.2826,'published',2),
('art-003','世博园','人机迷离——心 / 身 / 电 / 音 / 社','上海当代艺术博物馆','书本与龟形底座装置','2026-05-09','2026-08-23','assets/images/image-0a2b0324c635.webp',121.4862,31.1845,'published',3),
('art-004','世博园','削色','Longlati 经纬艺术中心','土黄色堆丘装置','2026-04-02','2026-08-20','assets/images/image-1d8efba9d31d.webp',121.4718,31.184,'published',4),
('art-005','世博园','黄含康：「鸟去空中真」','阿拉里奥画廊','书本与龟形底座装置（局部）','2026-05-20','2026-06-20','assets/images/image-8baf095e0cc6.webp',121.4734,31.1866,'published',5),
('art-006','外滩','克里斯蒂安娜·普利：打谷','贝浩登画廊','室内自行车人物影像','2026-05-07','2026-07-22','assets/images/image-3e9eab1aced0.webp',121.4882,31.2412,'published',6),
('art-007','徐汇滨江','胡炜钊：可控的灵韵','明圆美术馆','木质机械长臂装置','2026-04-10','2026-07-12','assets/images/image-94aea412d4b0.webp',121.453,31.1845,'published',7),
('art-008','徐汇滨江','从孤岛出发：姆明线稿上海首展','Re:Re: Art Space','木质平台与长杆装置','2026-03-10','2026-05-31','assets/images/image-b5824b1d0a5e.webp',121.45,31.179,'published',8),
('art-009','徐汇滨江','回响：她们的世纪','龙美术馆（西岸馆）','橙色螺旋绘画','2026-05-30','2026-08-15','assets/images/image-6703c3dd0470.webp',121.4457,31.1838,'published',9),
('art-010','苏州河','面具之下—中意当代影像艺术展','多伦现代美术馆','姆明角色线稿组','2026-05-15','2026-07-04','assets/images/image-147119eac9e0.webp',121.482,31.271,'published',10),
('art-011','世博园','UNFOLD 2026 上海艺术设计节','新天地喇格纳小学旧址','折页海报与印刷品墙','2026-05-19','2026-06-07','assets/images/image-49e753265c59.webp',121.4742,31.218,'published',11),
('art-012','徐汇滨江','加载…权限 4','UFO Terminal','老式电脑影像装置','2026-04-25','2026-06-28','assets/images/image-b8b48e7636e5.webp',121.4468,31.1925,'published',12)
on conflict(system_id) do nothing;

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  center_longitude double precision not null,
  center_latitude double precision not null,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.regions enable row level security;
create policy "regions are public" on public.regions for select to anon, authenticated using (true);
create policy "authenticated users manage regions" on public.regions for all to authenticated using (true) with check (true);
insert into public.regions(name,center_longitude,center_latitude,sort_order) values
('外滩',121.49185,31.24055,1),('苏州河',121.49390,31.27500,2),('世博园',121.49370,31.19420,3),('徐汇滨江',121.46080,31.19360,4)
on conflict(name) do nothing;

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
create policy "venues are public" on public.venues for select to anon, authenticated using (true);
create policy "authenticated users manage venues" on public.venues for all to authenticated using (true) with check (true);
insert into public.venues(name,longitude,latitude,sort_order)
select venue,max(longitude),max(latitude),row_number() over(order by venue)::integer from public.assets group by venue
on conflict(name) do nothing;
update public.assets a set venue_id=v.id from public.venues v where a.venue=v.name and a.venue_id is null;
alter table public.assets drop constraint if exists assets_venue_id_fkey;
alter table public.assets add constraint assets_venue_id_fkey foreign key (venue_id) references public.venues(id) on update cascade on delete restrict;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exhibition-assets','exhibition-assets',true,10485760,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do update set public=true;

drop policy if exists "public reads exhibition images" on storage.objects;
create policy "public reads exhibition images" on storage.objects for select to public using (bucket_id='exhibition-assets');
drop policy if exists "authenticated uploads exhibition images" on storage.objects;
create policy "authenticated uploads exhibition images" on storage.objects for insert to authenticated with check (bucket_id='exhibition-assets');
drop policy if exists "authenticated updates exhibition images" on storage.objects;
create policy "authenticated updates exhibition images" on storage.objects for update to authenticated using (bucket_id='exhibition-assets') with check (bucket_id='exhibition-assets');
drop policy if exists "authenticated deletes exhibition images" on storage.objects;
create policy "authenticated deletes exhibition images" on storage.objects for delete to authenticated using (bucket_id='exhibition-assets');
