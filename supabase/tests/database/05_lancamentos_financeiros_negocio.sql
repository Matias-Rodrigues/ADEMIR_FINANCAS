begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'financeiro_negocio', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'lancamentos_financeiros_negocio', 'tabela lancamentos_financeiros_negocio deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_financeiros_negocio
  (propriedade_id, unidade_negocio_id, tipo, valor, data, descricao, categoria, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'receita', 2842.80, '2026-07-05', 'Venda de leite', 'venda_leite', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.lancamentos_financeiros_negocio),
  1,
  'lançamento financeiro do negócio deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.lancamentos_financeiros_negocio (propriedade_id, unidade_negocio_id, tipo, valor, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'receita', -100, '2026-07-05', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "lancamentos_financeiros_negocio" violates check constraint "lancamentos_financeiros_negocio_valor_check"',
  'valor negativo deve ser rejeitado'
);

select * from finish();
rollback;
