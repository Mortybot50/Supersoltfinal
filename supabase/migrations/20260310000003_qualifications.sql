-- Qualifications module
-- qualification_types: org-level catalogue of qualification types
-- staff_qualifications: per-staff qualification records

create table if not exists public.qualification_types (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               uuid        not null references public.organizations(id) on delete cascade,
  name                 text        not null,
  description          text,
  validity_months      integer,                      -- null = no expiry
  required_for_roles   text[]      not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.qualification_types enable row level security;

create policy "qual_types_select" on public.qualification_types
  for select using (org_id IN (SELECT get_user_org_ids()));

create policy "qual_types_insert" on public.qualification_types
  for insert with check (org_id IN (SELECT get_user_org_ids()));

create policy "qual_types_update" on public.qualification_types
  for update using (org_id IN (SELECT get_user_org_ids()));

create policy "qual_types_delete" on public.qualification_types
  for delete using (org_id IN (SELECT get_user_org_ids()));

-- staff_qualifications: one row per (staff, qual_type) with evidence & expiry tracking
create table if not exists public.staff_qualifications (
  id                      uuid        primary key default gen_random_uuid(),
  org_id                  uuid        not null references public.organizations(id) on delete cascade,
  staff_id                uuid        not null references public.staff(id) on delete cascade,
  qualification_type_id   uuid        not null references public.qualification_types(id) on delete cascade,
  issue_date              date,
  expiry_date             date,
  certificate_number      text,
  evidence_url            text,
  status                  text        not null default 'valid'
                            check (status in ('valid', 'expiring', 'expired')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (staff_id, qualification_type_id)
);

alter table public.staff_qualifications enable row level security;

create policy "staff_quals_select" on public.staff_qualifications
  for select using (org_id IN (SELECT get_user_org_ids()));

create policy "staff_quals_insert" on public.staff_qualifications
  for insert with check (org_id IN (SELECT get_user_org_ids()));

create policy "staff_quals_update" on public.staff_qualifications
  for update using (org_id IN (SELECT get_user_org_ids()));

create policy "staff_quals_delete" on public.staff_qualifications
  for delete using (org_id IN (SELECT get_user_org_ids()));
