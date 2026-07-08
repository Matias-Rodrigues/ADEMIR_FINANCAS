begin;
select plan(3);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('22222222-2222-2222-2222-222222222222', 'Propriedade Outro Cliente');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values
  ('11111111-1111-1111-1111-111111111111', 'financeiro_negocio', true),
  ('22222222-2222-2222-2222-222222222222', 'financeiro_negocio', true);
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com'),
  ('44444444-4444-4444-4444-444444444444', 'outrocliente@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_financeiros_negocio
  (id, propriedade_id, unidade_negocio_id, tipo, valor, data, descricao, categoria, criado_por)
values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'receita', 2842.80, '2026-07-05', 'Venda de leite', 'venda_leite', '33333333-3333-3333-3333-333333333333');

update public.lancamentos_financeiros_negocio
  set valor = 3000.00, descricao = 'Venda de leite (corrigido)'
  where id = '77777777-7777-7777-7777-777777777777';

select is(
  (select valor from public.lancamentos_financeiros_negocio where id = '77777777-7777-7777-7777-777777777777'),
  3000.00,
  'admin deve conseguir editar um lancamento ja registrado (policy de UPDATE)'
);

select throws_ok(
  $$update public.lancamentos_financeiros_negocio set valor = -100 where id = '77777777-7777-7777-7777-777777777777'$$,
  'new row for relation "lancamentos_financeiros_negocio" violates check constraint "lancamentos_financeiros_negocio_valor_check"',
  'valor negativo deve ser rejeitado tambem na edicao'
);

-- usuario de OUTRA propriedade nao deve conseguir editar o lancamento acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

update public.lancamentos_financeiros_negocio
  set valor = 9999.99
  where id = '77777777-7777-7777-7777-777777777777';

-- volta ao contexto do admin dono do lancamento para conferir que o valor nao mudou
-- (o usuario da outra propriedade nem enxerga a linha via SELECT, entao a verificacao
-- precisa ser feita por quem tem visibilidade dela)
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select valor from public.lancamentos_financeiros_negocio where id = '77777777-7777-7777-7777-777777777777'),
  3000.00,
  'usuario de outra propriedade nao deve conseguir editar lancamento alheio (isolamento RLS)'
);

select * from finish();
rollback;
