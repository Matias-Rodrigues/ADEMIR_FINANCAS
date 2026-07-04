begin;
select plan(1);

select has_extension('pgtap', 'extensão pgtap deve estar habilitada');

select * from finish();
rollback;
