begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('22222222-2222-2222-2222-222222222222', 'Propriedade Outro Cliente');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values
  ('11111111-1111-1111-1111-111111111111', 'producao', true),
  ('22222222-2222-2222-2222-222222222222', 'producao', true);
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com'),
  ('44444444-4444-4444-4444-444444444444', 'outrocliente@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'producao_animal', 'tabela producao_animal deve existir');
select has_view('public', 'producao_animal_total_dia', 'view producao_animal_total_dia deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'vaca_lactacao', '33333333-3333-3333-3333-333333333333'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '102', 'femea', 'vaca_lactacao', '33333333-3333-3333-3333-333333333333');

insert into public.producao_animal (animal_id, propriedade_id, unidade_negocio_id, data, numero_ordenha, litros, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 1, 12.5, '33333333-3333-3333-3333-333333333333'),
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 2, 10.0, '33333333-3333-3333-3333-333333333333'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 1, 8.0, '33333333-3333-3333-3333-333333333333');

select is(
  (select total_produzido from public.producao_animal_total_dia where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and data = '2026-07-09'),
  30.5,
  'total produzido deve somar todos os animais e ordenhas do dia (12.5 + 10.0 + 8.0)'
);

select throws_ok(
  $$insert into public.producao_animal (animal_id, propriedade_id, unidade_negocio_id, data, numero_ordenha, litros, criado_por)
    values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 1, 5.0, '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "producao_animal_animal_id_data_numero_ordenha_key"',
  'lancamento duplicado (mesmo animal+data+ordenha) deve ser rejeitado'
);

select throws_ok(
  $$insert into public.producao_animal (animal_id, propriedade_id, unidade_negocio_id, data, numero_ordenha, litros, criado_por)
    values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 3, -1, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "producao_animal" violates check constraint "producao_animal_litros_check"',
  'litros negativo deve ser rejeitado'
);

-- usuario de OUTRA propriedade nao deve ver os lancamentos acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.producao_animal),
  0,
  'usuario de outra propriedade nao deve ver producao por animal alheia (isolamento RLS)'
);

select * from finish();
rollback;
