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

select * from finish();
rollback;
