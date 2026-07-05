begin;
select plan(4);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

select has_table('public', 'propriedade_modulos_contratados', 'tabela propriedade_modulos_contratados deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('77777777-7777-7777-7777-777777777777', 'producao', true);

select is(
  (select count(*)::int from public.propriedade_modulos_contratados where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  1,
  'dev deve conseguir inserir entitlement para propriedade que nao e a sua'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select throws_ok(
  $$insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values ('11111111-1111-1111-1111-111111111111', 'fiscal', true)$$,
  'new row violates row-level security policy for table "propriedade_modulos_contratados"',
  'admin nao deve conseguir gerenciar (inserir) modulos contratados'
);

select is(
  (select count(*)::int from public.propriedade_modulos_contratados where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'admin deve conseguir consultar (mesmo vazio) os modulos contratados da propria propriedade, sem erro de permissao'
);

select * from finish();
rollback;
