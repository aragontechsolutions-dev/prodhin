-- Routes module
-- Each route belongs to a driver and contains stops per day of week
-- day_of_week: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  driver_id uuid references profiles(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on routes (driver_id, is_active);

create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  created_at timestamptz not null default now(),
  unique (route_id, customer_id, day_of_week)
);

create index on route_stops (route_id, day_of_week);
create index on route_stops (customer_id);

-- RLS
alter table routes enable row level security;
alter table route_stops enable row level security;

create policy "routes: admin full access"
  on routes for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "routes: driver reads own route"
  on routes for select
  to authenticated
  using (
    public.get_my_role() = 'chofer'
    and (
      driver_id = auth.uid()
      or driver_id in (
        select from_driver_id from driver_delegations
        where to_driver_id = auth.uid()
          and is_active = true
          and start_date <= current_date
          and end_date >= current_date
      )
    )
  );

create policy "route_stops: admin full access"
  on route_stops for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "route_stops: driver reads own stops"
  on route_stops for select
  to authenticated
  using (
    public.get_my_role() = 'chofer'
    and route_id in (
      select id from routes
      where driver_id = auth.uid()
        or driver_id in (
          select from_driver_id from driver_delegations
          where to_driver_id = auth.uid()
            and is_active = true
            and start_date <= current_date
            and end_date >= current_date
        )
    )
  );
