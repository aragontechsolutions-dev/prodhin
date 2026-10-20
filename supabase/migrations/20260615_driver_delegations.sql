create table if not exists driver_delegations (
  id uuid primary key default gen_random_uuid(),
  from_driver_id uuid not null references profiles(id) on delete cascade,
  to_driver_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint different_drivers check (from_driver_id <> to_driver_id),
  constraint valid_dates check (end_date >= start_date)
);

create index on driver_delegations (to_driver_id, is_active, start_date, end_date);
create index on driver_delegations (from_driver_id, is_active);
