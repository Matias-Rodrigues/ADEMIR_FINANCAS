begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

-- membro nao-admin: SELECT so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.propriedades where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'membro nao-admin deve enxergar a propria propriedade'
);

select is(
  (select count(*)::int from public.propriedades where id = '77777777-7777-7777-7777-777777777777'),
  0,
  'membro nao-admin nao deve enxergar propriedade de outro cliente'
);

-- admin: UPDATE so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

update public.propriedades set nome = 'Propriedade Ademir Renomeada' where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select nome from public.propriedades where id = '11111111-1111-1111-1111-111111111111'),
  'Propriedade Ademir Renomeada',
  'admin deve conseguir renomear a propria propriedade'
);

update public.propriedades set nome = 'Hackeado' where id = '77777777-7777-7777-7777-777777777777';

-- a policy de SELECT restringe o admin a propria propriedade, entao a
-- verificacao abaixo precisa de um papel sem RLS para ler o valor real
-- da propriedade de outro cliente (o objetivo aqui e provar que o UPDATE
-- nao teve efeito, nao que o admin passou a enxergar a linha)
reset role;

select is(
  (select nome from public.propriedades where id = '77777777-7777-7777-7777-777777777777'),
  'Propriedade Cliente B',
  'admin nao deve conseguir renomear propriedade de outro cliente'
);

set local role authenticated;

select throws_ok(
  $$insert into public.propriedades (nome) values ('Propriedade Nova')$$,
  'new row violates row-level security policy for table "propriedades"',
  'admin nao deve conseguir criar uma nova propriedade'
);

-- dev: INSERT liberado
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.propriedades (id, nome) values ('99999999-9999-9999-9999-999999999999', 'Propriedade Nova do Dev');

select is(
  (select count(*)::int from public.propriedades where id = '99999999-9999-9999-9999-999999999999'),
  1,
  'dev deve conseguir criar uma nova propriedade'
);

select * from finish();
rollback;
