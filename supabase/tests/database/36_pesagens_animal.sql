begin;
select plan(8);

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

select has_table('public', 'pesagens_animal', 'tabela pesagens_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'terneira_aleitamento', '33333333-3333-3333-3333-333333333333');

insert into public.pesagens_animal (id, propriedade_id, animal_id, data, peso_kg, criado_por) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 45.5, '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.pesagens_animal),
  1,
  'admin deve conseguir lancar uma pesagem'
);

select throws_ok(
  $$insert into public.pesagens_animal (propriedade_id, animal_id, data, peso_kg, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 0, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "pesagens_animal" violates check constraint "pesagens_animal_peso_kg_check"',
  'peso zero ou negativo deve ser rejeitado'
);

insert into public.pesagens_animal (propriedade_id, animal_id, data, peso_kg, criado_por) values
  ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 46.0, '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.pesagens_animal where animal_id = '77777777-7777-7777-7777-777777777777' and data = '2026-07-09'),
  2,
  'multiplas pesagens no mesmo dia devem ser aceitas'
);

update public.pesagens_animal set peso_kg = 47.0 where id = '88888888-8888-8888-8888-888888888888';

select is(
  (select peso_kg from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888'),
  47.0,
  'admin deve conseguir editar uma pesagem ja lancada'
);

-- usuario de OUTRA propriedade nao deve ver, editar nem excluir a pesagem acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.pesagens_animal),
  0,
  'usuario de outra propriedade nao deve ver pesagens alheias (isolamento RLS)'
);

update public.pesagens_animal set peso_kg = 999 where id = '88888888-8888-8888-8888-888888888888';
delete from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888';

-- volta ao contexto do admin dono para conferir que nada mudou
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select peso_kg from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888'),
  47.0,
  'usuario de outra propriedade nao deve conseguir editar pesagem alheia (isolamento RLS)'
);

select is(
  (select count(*)::int from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888'),
  1,
  'usuario de outra propriedade nao deve conseguir excluir pesagem alheia (isolamento RLS)'
);

select * from finish();
rollback;
