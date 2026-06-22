-- Username support (login by username; display name in the app).
-- Supabase still authenticates by email; `profiles` maps a unique username to a
-- user, and the auth-login Edge Function resolves username -> email server-side.

create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  username   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- case-insensitive unique usernames
create unique index uq_profiles_username_lower on public.profiles (lower(username));

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "own profile - select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "own profile - insert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile - update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed the profile on signup from the username passed in user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into public.notification_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  if coalesce(new.raw_user_meta_data ->> 'username', '') <> '' then
    insert into public.profiles (user_id, username)
      values (new.id, new.raw_user_meta_data ->> 'username')
      on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
