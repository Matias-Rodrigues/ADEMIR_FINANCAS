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

select has_table('public', 'producao_leite', 'tabela producao_leite deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 965.6, 15, 10, 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.producao_leite),
  1,
  'lançamento de produção de leite deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.producao_leite (propriedade_id, unidade_negocio_id, data, litros_comercial, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', -10, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "producao_leite" violates check constraint "producao_leite_litros_comercial_check"',
  'litros_comercial negativo deve ser rejeitado'
);

select throws_ok(
  $$insert into public.producao_leite (propriedade_id, unidade_negocio_id, data, litros_comercial, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 900, '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "producao_leite_unidade_negocio_id_data_key"',
  'segundo lançamento no mesmo dia/unidade deve ser rejeitado pelo unique'
);

update public.producao_leite
  set litros_comercial = 1200.5
  where propriedade_id = '11111111-1111-1111-1111-111111111111'
    and unidade_negocio_id = '66666666-6666-6666-6666-666666666666'
    and data = '2026-07-01';

select is(
  (select litros_comercial from public.producao_leite
    where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and data = '2026-07-01'),
  1200.5,
  'admin deve conseguir editar um lançamento existente de produção de leite'
);

select * from finish();
rollback;
