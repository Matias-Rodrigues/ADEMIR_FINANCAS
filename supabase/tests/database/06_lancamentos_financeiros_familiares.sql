begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.pessoas_fisicas (id, propriedade_id, nome, cpf)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ademir', '11111111111');

select has_table('public', 'lancamentos_financeiros_familiares', 'tabela lancamentos_financeiros_familiares deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_financeiros_familiares
  (propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, descricao, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', false, 'despesa', 150.00, '2026-07-05', 'Farmácia', '33333333-3333-3333-3333-333333333333');

insert into public.lancamentos_financeiros_familiares
  (propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, descricao, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', null, true, 'despesa', 100.00, '2026-07-01', 'Fatia pessoal do rateio de energia', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.lancamentos_financeiros_familiares),
  2,
  'deve aceitar lançamento vinculado a CPF e lançamento consolidado sem CPF'
);

select throws_ok(
  $$insert into public.lancamentos_financeiros_familiares (propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, 'despesa', 50, '2026-07-05', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "lancamentos_financeiros_familiares" violates check constraint "lff_consolidado_sem_cpf_check"',
  'não pode ter pessoa_fisica_id preenchido junto com eh_consolidado_familiar=true'
);

select * from finish();
rollback;
