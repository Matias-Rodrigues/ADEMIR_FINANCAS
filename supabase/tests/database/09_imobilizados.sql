begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'imobilizado', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Suínos', 'suinos');

select has_table('public', 'imobilizados', 'tabela imobilizados deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.imobilizados (propriedade_id, unidade_negocio_id, nome, valor_aquisicao, data_aquisicao, vida_util_anos)
values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 'Galpão de suínos 2017', 240000.00, '2017-03-01', 25);

select is(
  (select count(*)::int from public.imobilizados),
  1,
  'imobilizado deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.imobilizados (propriedade_id, unidade_negocio_id, nome, valor_aquisicao, data_aquisicao, vida_util_anos)
    values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 'Item inválido', 1000.00, '2020-01-01', 0)$$,
  'new row for relation "imobilizados" violates check constraint "imobilizados_vida_util_anos_check"',
  'vida_util_anos deve ser maior que zero'
);

select * from finish();
rollback;
