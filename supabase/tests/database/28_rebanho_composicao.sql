begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_function('public', 'rebanho_composicao', array['uuid', 'date'], 'funcao rebanho_composicao deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

-- inventário inicial em 2026-07-01: 38 vacas em lactação, 8 novilhas em recria
insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 38, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 8, 'novilha_recria', 'manual', '33333333-3333-3333-3333-333333333333');

-- 10/07: 2 novilhas em recria viram vacas em lactação (pariram)
insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, categoria_origem, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'mudanca_categoria', '2026-07-10', 2, 'vaca_lactacao', 'novilha_recria', 'manual', '33333333-3333-3333-3333-333333333333');

-- 15/07: 1 vaca em lactação morre
insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'mortalidade', '2026-07-15', 1, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select quantidade from public.rebanho_composicao('66666666-6666-6666-6666-666666666666', '2026-07-20') where categoria = 'vaca_lactacao'),
  39::bigint,
  'vacas em lactacao em 20/07 deve ser 38 + 2 (mudanca) - 1 (morte) = 39'
);

select is(
  (select quantidade from public.rebanho_composicao('66666666-6666-6666-6666-666666666666', '2026-07-20') where categoria = 'novilha_recria'),
  6::bigint,
  'novilhas em recria em 20/07 deve ser 8 - 2 (mudanca) = 6'
);

select * from finish();
rollback;
