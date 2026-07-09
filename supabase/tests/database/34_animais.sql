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

select has_table('public', 'animais', 'tabela animais deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais
  (id, propriedade_id, unidade_negocio_id, brinco, nome, sexo, categoria, data_nascimento, criado_por)
values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'Mimosa', 'femea', 'vaca_lactacao', '2020-05-10', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.animais),
  1,
  'admin deve conseguir cadastrar um animal'
);

insert into public.animais
  (propriedade_id, unidade_negocio_id, brinco, sexo, categoria, mae_id, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '102', 'femea', 'terneira_aleitamento', '77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333');

select is(
  (select mae_id from public.animais where brinco = '102'),
  '77777777-7777-7777-7777-777777777777'::uuid,
  'mae_id deve vincular a outro animal da mesma propriedade'
);

select throws_ok(
  $$insert into public.animais (propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'vaca_lactacao', '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "animais_propriedade_id_brinco_key"',
  'brinco duplicado na mesma propriedade deve ser rejeitado'
);

select throws_ok(
  $$insert into public.animais (propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '103', 'femea', 'categoria_invalida', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "animais" violates check constraint "animais_categoria_check"',
  'categoria fora da lista deve ser rejeitada'
);

-- usuario de OUTRA propriedade nao deve ver os animais acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.animais),
  0,
  'usuario de outra propriedade nao deve ver animais alheios (isolamento RLS)'
);

select * from finish();
rollback;
