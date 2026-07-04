begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Suínos', 'suinos');

select has_table('public', 'lancamentos_custo_compartilhado', 'tabela lancamentos_custo_compartilhado deve existir');
select has_table('public', 'rateio_custo_compartilhado_itens', 'tabela rateio_custo_compartilhado_itens deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_custo_compartilhado (id, propriedade_id, data, descricao, valor_total, criado_por)
values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '2026-07-01', 'Conta de energia - julho', 1000.00, '33333333-3333-3333-3333-333333333333');

insert into public.rateio_custo_compartilhado_itens (lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor) values
  ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '66666666-6666-6666-6666-666666666666', 700.00),
  ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '88888888-8888-8888-8888-888888888888', 200.00),
  ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'familiar_consolidado', null, 100.00);

select is(
  (select count(*)::int from public.rateio_custo_compartilhado_itens where lancamento_custo_compartilhado_id = '99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3,
  'rateio com soma igual ao total deve ser aceito'
);

select throws_ok(
  $$insert into public.rateio_custo_compartilhado_itens (lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor)
    values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '66666666-6666-6666-6666-666666666666', 5000.00)$$,
  'soma dos itens de rateio (6000.00) difere do valor_total (1000.00)',
  'rateio cuja soma diverge do valor_total deve ser rejeitado'
);

select * from finish();
rollback;
