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

insert into public.pessoas_fisicas (id, propriedade_id, nome, cpf) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Ademir', '11111111111'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'Cliente B', '22222222222');

-- membro nao-admin: nenhum acesso, nem leitura
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'membro nao-admin nao deve enxergar pessoas_fisicas, nem da propria propriedade'
);

-- admin: SELECT/INSERT so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'admin deve enxergar pessoas_fisicas da propria propriedade'
);

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  0,
  'admin nao deve enxergar pessoas_fisicas de outra propriedade'
);

insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('11111111-1111-1111-1111-111111111111', 'Filho do Ademir', '33333333333');

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'admin deve conseguir inserir pessoa fisica na propria propriedade'
);

select throws_ok(
  $$insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('77777777-7777-7777-7777-777777777777', 'Intruso', '44444444444')$$,
  'new row violates row-level security policy for table "pessoas_fisicas"',
  'admin nao deve conseguir inserir pessoa fisica em outra propriedade'
);

-- dev: INSERT liberado em qualquer propriedade
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('77777777-7777-7777-7777-777777777777', 'Suporte Dev', '55555555555');

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  2,
  'dev deve conseguir inserir pessoa fisica em propriedade que nao e a sua'
);

select * from finish();
rollback;
