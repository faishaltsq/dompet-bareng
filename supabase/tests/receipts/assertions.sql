-- Assertion helpers for the receipt storage proofs. Every denial is proven
-- individually with its expected SQLSTATE so one broad catch block cannot hide
-- a different failure.

create or replace function public.test_reject(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'RECEIPT_ASSERT: expected SQLSTATE % but got % (%)', expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'RECEIPT_ASSERT: expected SQLSTATE % but the statement succeeded', expected_state;
end $$;

create or replace function public.test_assert_count(actual bigint, expected bigint, message text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'RECEIPT_ASSERT: % (expected %, got %)', message, expected, actual;
  end if;
end $$;
