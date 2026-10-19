create or replace function public.test_reject(statement text, expected_state text) returns void language plpgsql as $$
begin
 begin
  execute statement;
 exception when others then
  if sqlstate=expected_state then return; end if;
  raise;
 end;
 raise exception 'QR_JOIN_ASSERT: expected SQLSTATE %',expected_state;
end $$;
