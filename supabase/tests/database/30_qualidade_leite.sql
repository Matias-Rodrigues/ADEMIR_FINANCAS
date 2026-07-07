begin;
select plan(5);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'qualidade_leite', 'tabela qualidade_leite deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.qualidade_leite
  (propriedade_id, unidade_negocio_id, mes, ccs, cbt, gordura, proteina, esd, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 629, 14, 3.94, 3.42, 8.6, 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.qualidade_leite),
  1,
  'resultado de qualidade deve ser inserido e visível pelo admin'
);

update public.qualidade_leite set gordura = 4.10 where mes = '2026-07-01';

select is(
  (select gordura from public.qualidade_leite where mes = '2026-07-01'),
  4.10,
  'admin deve conseguir editar um resultado ja lancado (policy de UPDATE)'
);

select throws_ok(
  $$insert into public.qualidade_leite (propriedade_id, unidade_negocio_id, mes, ccs, cbt, gordura, proteina, esd, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-08-01', 100, 10, 105, 3, 8, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "qualidade_leite" violates check constraint "qualidade_leite_gordura_check"',
  'gordura acima de 100 deve ser rejeitada'
);

select throws_ok(
  $$insert into public.qualidade_leite (propriedade_id, unidade_negocio_id, mes, ccs, cbt, gordura, proteina, esd, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 700, 15, 3.9, 3.4, 8.5, '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "qualidade_leite_unidade_negocio_id_mes_key"',
  'segundo resultado no mesmo mes/unidade deve ser rejeitado pelo unique'
);

select * from finish();
rollback;
