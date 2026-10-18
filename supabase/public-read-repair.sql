begin;
do $policy$
declare t text;
begin
  foreach t in array array['cases','sources','problem_areas'] loop
    execute format('drop policy if exists min_owner_guard on public.%I',t);
    execute format('create policy min_owner_read_guard on public.%I as restrictive for select to anon, authenticated using ((select auth.uid()) = %L::uuid or (current_user = %L and published is true))',t,'cdfff424-d750-4f82-baa3-d17a6113af53','anon');
    execute format('create policy min_owner_insert_guard on public.%I as restrictive for insert to anon, authenticated with check ((select auth.uid()) = %L::uuid)',t,'cdfff424-d750-4f82-baa3-d17a6113af53');
    execute format('create policy min_owner_update_guard on public.%I as restrictive for update to anon, authenticated using ((select auth.uid()) = %L::uuid) with check ((select auth.uid()) = %L::uuid)',t,'cdfff424-d750-4f82-baa3-d17a6113af53','cdfff424-d750-4f82-baa3-d17a6113af53');
    execute format('create policy min_owner_delete_guard on public.%I as restrictive for delete to anon, authenticated using ((select auth.uid()) = %L::uuid)',t,'cdfff424-d750-4f82-baa3-d17a6113af53');
  end loop;
end $policy$;
commit;
