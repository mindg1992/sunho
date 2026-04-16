-- 선호피엔에스 설비보전일지 스키마
-- Supabase SQL Editor에서 이 파일을 실행하세요.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  pin_hash text not null,
  role text not null default 'user' check (role in ('user','admin')),
  sort_order int default 100,
  created_at timestamptz default now()
);

-- 기존 DB 마이그레이션 (이미 users 테이블 있는 경우 한번 실행)
alter table users add column if not exists sort_order int default 100;

-- 공장별 사용자 정의 컬럼 (관리자가 +열추가로 생성)
alter table factory1_logs add column if not exists custom_values jsonb default '{}'::jsonb;
alter table factory2_logs add column if not exists custom_values jsonb default '{}'::jsonb;

create table if not exists custom_columns (
  id uuid primary key default gen_random_uuid(),
  factory_id text not null,
  col_key text not null,
  label text not null,
  tint text,
  sort_order int default 1000,
  created_at timestamptz default now(),
  unique (factory_id, col_key)
);

-- 기본 컬럼 숨기기 (관리자가 X 눌러서 숨김)
create table if not exists hidden_columns (
  factory_id text not null,
  col_key text not null,
  created_at timestamptz default now(),
  primary key (factory_id, col_key)
);

create table if not exists factory1_logs (
  log_date date primary key,
  jungbuha numeric,
  choedae_buha numeric,
  gyeongbuha numeric,
  muhyo_power numeric,
  peak numeric,
  yeokryul numeric,
  heup1 numeric,
  heup2 numeric,
  bag_acf numeric,
  water_main numeric,
  water_env numeric,
  gas numeric,
  blower numeric,
  temp numeric,
  ro_press numeric,
  jungap numeric,
  comp50 numeric,
  baekfilter numeric,
  baekrpm numeric,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists factory2_logs (
  log_date date primary key,
  jung_choedae numeric,
  gyeongbuha numeric,
  muhyo_power numeric,
  peak numeric,
  yeokryul numeric,
  heup1 numeric,
  heup2 numeric,
  bag_acf numeric,
  water_index numeric,
  sw1 numeric,
  sw2 numeric,
  gas numeric,
  blower numeric,
  temp numeric,
  ro_press numeric,
  jungap numeric,
  comp50 numeric,
  baekfilter numeric,
  baekrpm numeric,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists weather_logs (
  log_date date primary key,
  weather_text text,
  factory1_workers smallint,
  factory2_workers smallint,
  updated_by text,
  updated_at timestamptz default now()
);

-- 기존 DB 마이그레이션
alter table weather_logs add column if not exists factory1_workers smallint;
alter table weather_logs add column if not exists factory2_workers smallint;
