begin;
select plan(9);

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

select has_table('public', 'vacinas_animal', 'tabela vacinas_animal deve existir');
select has_table('public', 'medicamentos_animal', 'tabela medicamentos_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'terneira_aleitamento', '33333333-3333-3333-3333-333333333333');

insert into public.vacinas_animal (propriedade_id, animal_id, data, produto, criado_por) values
  ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 'Vacina Aftosa', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.vacinas_animal),
  1,
  'admin deve conseguir lancar uma vacina'
);

insert into public.medicamentos_animal (id, propriedade_id, animal_id, data, produto, dias_carencia, criado_por) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-01', 'Antibiotico X', 5, '33333333-3333-3333-3333-333333333333');

select is(
  (select data_liberacao from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888'),
  '2026-07-06'::date,
  'data_liberacao deve ser calculada como data + dias_carencia'
);

select throws_ok(
  $$insert into public.medicamentos_animal (propriedade_id, animal_id, data, produto, dias_carencia, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 'Produto invalido', -1, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "medicamentos_animal" violates check constraint "medicamentos_animal_dias_carencia_check"',
  'dias_carencia negativo deve ser rejeitado'
);

-- usuario de OUTRA propriedade nao deve ver, editar nem excluir os registros acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.vacinas_animal),
  0,
  'usuario de outra propriedade nao deve ver vacinas alheias (isolamento RLS)'
);

select is(
  (select count(*)::int from public.medicamentos_animal),
  0,
  'usuario de outra propriedade nao deve ver medicamentos alheios (isolamento RLS)'
);

update public.medicamentos_animal set dias_carencia = 999 where id = '88888888-8888-8888-8888-888888888888';
delete from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888';

-- volta ao contexto do admin dono para conferir que nada mudou
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select dias_carencia from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888'),
  5,
  'usuario de outra propriedade nao deve conseguir editar medicamento alheio (isolamento RLS)'
);

select is(
  (select count(*)::int from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888'),
  1,
  'usuario de outra propriedade nao deve conseguir excluir medicamento alheio (isolamento RLS)'
);

select * from finish();
rollback;
