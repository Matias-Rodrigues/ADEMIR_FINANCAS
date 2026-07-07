begin;
select plan(6);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'imobilizado', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_column('public', 'imobilizados', 'valor_residual', 'coluna valor_residual deve existir');
select has_view('public', 'imobilizados_depreciacao', 'view imobilizados_depreciacao deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.imobilizados
  (propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual, data_aquisicao, vida_util_anos)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'benfeitoria', 'Sala de Ordenha', 80000, 16000, '2020-01-01', 20);

select is(
  (select depreciacao_anual from public.imobilizados_depreciacao where nome = 'Sala de Ordenha'),
  3200.00,
  'depreciacao anual deve ser (80000 - 16000) / 20 = 3200'
);

select is(
  (select round(depreciacao_mensal, 2) from public.imobilizados_depreciacao where nome = 'Sala de Ordenha'),
  266.67,
  'depreciacao mensal deve ser 3200 / 12 = 266.67'
);

update public.imobilizados set ativo = false where nome = 'Sala de Ordenha';

select is(
  (select ativo from public.imobilizados where nome = 'Sala de Ordenha'),
  false,
  'admin deve conseguir editar (dar baixa) um bem ja lancado (policy de UPDATE)'
);

select throws_ok(
  $$insert into public.imobilizados (propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual, data_aquisicao, vida_util_anos)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'maquina', 'Item invalido', 1000, 2000, '2020-01-01', 10)$$,
  'new row for relation "imobilizados" violates check constraint "imobilizados_valor_residual_check"',
  'valor_residual maior que valor_aquisicao deve ser rejeitado'
);

select * from finish();
rollback;
