begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

insert into public.propriedades (id, nome) values ('22222222-2222-2222-2222-222222222222', 'Propriedade Outro Produtor');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('22222222-2222-2222-2222-222222222222', 'producao', true);
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'outro@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Gado leiteiro B', 'leite');

select has_view('public', 'producao_leite_mensal', 'view producao_leite_mensal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 40, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333');

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 965.6, 15, 10, 'manual', '33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-02', 869.1, 10, 5, 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select producao_total from public.producao_leite_mensal
    where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and mes = '2026-07-01'),
  1874.7,
  'producao_total de julho deve ser a soma dos 3 destinos dos 2 dias lancados'
);

select is(
  (select vacas_lactacao from public.producao_leite_mensal
    where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and mes = '2026-07-01'),
  40::bigint,
  'vacas_lactacao de julho deve vir de rebanho_composicao no ultimo dia do mes'
);

select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 'ajuste_inventario', '2026-07-01', 10, 'vaca_lactacao', 'manual', '44444444-4444-4444-4444-444444444444');

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, origem, criado_por)
values
  ('22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', '2026-07-01', 999, 0, 0, 'manual', '44444444-4444-4444-4444-444444444444');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.producao_leite_mensal),
  1,
  'usuario da propriedade A nao deve ver linha da propriedade B na view producao_leite_mensal'
);

select * from finish();
rollback;
