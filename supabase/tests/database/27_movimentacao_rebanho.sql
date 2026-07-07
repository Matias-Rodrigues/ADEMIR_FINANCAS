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

select has_column('public', 'eventos_operacionais', 'categoria_animal', 'coluna categoria_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 38, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.eventos_operacionais where tipo_evento = 'ajuste_inventario'),
  1,
  'ajuste_inventario deve ser inserido e visível pelo admin'
);

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, categoria_origem, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'mudanca_categoria', '2026-07-10', 2, 'vaca_lactacao', 'novilha_recria', 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.eventos_operacionais where tipo_evento = 'mudanca_categoria'),
  1,
  'mudanca_categoria deve ser inserida e visível pelo admin'
);

select throws_ok(
  $$insert into public.eventos_operacionais (propriedade_id, unidade_negocio_id, tipo_evento, data, categoria_animal, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'nascimento', '2026-07-11', 'categoria_invalida', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "eventos_operacionais" violates check constraint "eventos_operacionais_categoria_animal_check"',
  'categoria_animal fora do enum deve ser rejeitada'
);

select throws_ok(
  $$insert into public.eventos_operacionais (propriedade_id, unidade_negocio_id, tipo_evento, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'tipo_invalido', '2026-07-11', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "eventos_operacionais" violates check constraint "eventos_operacionais_tipo_evento_check"',
  'tipo_evento fora do enum estendido continua sendo rejeitado'
);

select * from finish();
rollback;
