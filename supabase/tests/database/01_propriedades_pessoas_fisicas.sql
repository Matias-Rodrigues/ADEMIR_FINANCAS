begin;
select plan(4);

insert into public.propriedades (id, nome)
values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');

select has_table('public', 'propriedades', 'tabela propriedades deve existir');
select has_table('public', 'pessoas_fisicas', 'tabela pessoas_fisicas deve existir');

insert into public.pessoas_fisicas (id, propriedade_id, nome, cpf)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ademir', '11111111111');

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'pessoa física deve estar vinculada à propriedade'
);

select throws_ok(
  $$insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('11111111-1111-1111-1111-111111111111', 'Duplicado', '11111111111')$$,
  'duplicate key value violates unique constraint "pessoas_fisicas_cpf_key"',
  'CPF duplicado deve ser rejeitado'
);

select * from finish();
rollback;
