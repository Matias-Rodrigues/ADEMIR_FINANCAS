begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'obrigacoes_credito', 'tabela obrigacoes_credito deve existir');
select has_table('public', 'parcelas_credito', 'tabela parcelas_credito deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.obrigacoes_credito (id, propriedade_id, instituicao, tipo, unidade_negocio_id, valor_total, data_contratacao)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Cresol', 'consorcio', '66666666-6666-6666-6666-666666666666', 150000.00, '2025-01-15');

insert into public.parcelas_credito (obrigacao_credito_id, numero_parcela, valor, data_vencimento)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 15000.00, '2026-08-15');

select is(
  (select count(*)::int from public.parcelas_credito where obrigacao_credito_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'parcela deve ser inserida vinculada à obrigação'
);

select throws_ok(
  $$insert into public.parcelas_credito (obrigacao_credito_id, numero_parcela, valor, data_vencimento)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 15000.00, '2026-09-15')$$,
  'duplicate key value violates unique constraint "parcelas_credito_obrigacao_credito_id_numero_parcela_key"',
  'não pode haver duas parcelas com o mesmo número para a mesma obrigação'
);

select * from finish();
rollback;
