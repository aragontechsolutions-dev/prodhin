-- Allow a covering driver to read customers delegated to them while covering
-- for a driver on leave (in addition to their own directly assigned customers).

create policy "customers: chofer ve delegados"
  on public.customers for select
  using (
    public.get_my_role() = 'chofer'
    and is_active = true
    and id in (
      select dc.customer_id
      from public.driver_customers dc
      where dc.driver_id in (
        select dd.from_driver_id
        from public.driver_delegations dd
        where dd.to_driver_id = public.get_my_id()
          and dd.is_active = true
          and dd.start_date <= current_date
          and dd.end_date >= current_date
      )
    )
  );
