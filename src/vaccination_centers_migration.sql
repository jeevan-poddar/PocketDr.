-- Create the vaccination_centers table
create table if not exists public.vaccination_centers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  state text not null,
  city text not null,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add center_id column to vaccinations table
alter table public.vaccinations 
add column if not exists center_id uuid references public.vaccination_centers(id);

-- Enable Row Level Security (RLS) on vaccination_centers
alter table public.vaccination_centers enable row level security;

-- Create policy to allow read access to everyone
create policy "Enable read access for all users" on public.vaccination_centers
  for select using (true);

-- Create policy to allow insert/update/delete for authenticated users (or robust admin check if needed)
-- For now, allowing authenticated users to manage useful for admin, but ideally restricts to admin role.
-- Assuming basic authenticated access for now as per admin page logic.
create policy "Enable all access for authenticated users" on public.vaccination_centers
  for all using (auth.role() = 'authenticated');
