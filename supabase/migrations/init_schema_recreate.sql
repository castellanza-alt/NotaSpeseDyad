-- 1. CREAZIONE TABELLA PROFILES
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  display_name text,
  default_emails text[],
  is_default_email boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

alter table public.profiles enable row level security;

-- Policy Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- 2. CREAZIONE TABELLA EXPENSES
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  merchant text,
  expense_date date,
  total numeric,
  currency text default 'EUR',
  category text,
  image_url text,
  items jsonb,
  vat_number text,
  address text,
  latitude float,
  longitude float,
  sent_to_email text,
  sent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.expenses enable row level security;

-- Policy Expenses
create policy "Users can view own expenses" on public.expenses for select using (auth.uid() = user_id);
create policy "Users can insert own expenses" on public.expenses for insert with check (auth.uid() = user_id);
create policy "Users can update own expenses" on public.expenses for update using (auth.uid() = user_id);
create policy "Users can delete own expenses" on public.expenses for delete using (auth.uid() = user_id);

-- 3. STORAGE BUCKET PER SCONTRINI
insert into storage.buckets (id, name, public) 
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Policy Storage
create policy "Authenticated users can upload receipts"
on storage.objects for insert to authenticated 
with check (bucket_id = 'receipts' and auth.uid() = owner);

create policy "Authenticated users can view receipts"
on storage.objects for select to authenticated 
using (bucket_id = 'receipts');

create policy "Authenticated users can update receipts"
on storage.objects for update to authenticated 
using (bucket_id = 'receipts' and auth.uid() = owner);