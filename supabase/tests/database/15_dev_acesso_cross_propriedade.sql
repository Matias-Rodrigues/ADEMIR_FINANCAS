begin;
select plan(4);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Cliente A'),
  ('99999999-9999-9999-9999-999999999999', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'clienteB@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev'),
  ('55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', 'admin');

insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '99999999-9999-9999-9999-999999999999', 'Gado leiteiro', 'leite');

insert into public.lancamentos_custo_compartilhado (id, propriedade_id, data, descricao, valor_total, criado_por)
  values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', '2026-07-01', 'Conta de energia', 500.00, '55555555-5555-5555-5555-555555555555');

insert into public.rateio_custo_compartilhado_itens (lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor)
  values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '66666666-6666-6666-6666-666666666666', 500.00);

-- dev pertence a propriedade A mas precisa enxergar dados da propriedade B (suporte)
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.unidades_negocio where propriedade_id = '99999999-9999-9999-9999-999999999999'),
  1,
  'dev deve enxergar unidades_negocio de uma propriedade que nao e a sua'
);

select is(
  (select count(*)::int from public.rateio_custo_compartilhado_itens where lancamento_custo_compartilhado_id = '99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'dev deve enxergar itens de rateio (tabela filho via EXISTS) de uma propriedade que nao e a sua'
);

select is(
  (select count(*)::int from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  1,
  'dev deve enxergar a linha de usuarios de uma propriedade que nao e a sua'
);

select is(
  (select papel from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  'admin',
  'dev deve conseguir ler os dados completos da linha de usuarios de outra propriedade'
);

select * from finish();
rollback;
