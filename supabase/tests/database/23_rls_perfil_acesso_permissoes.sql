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

insert into public.perfis_acesso (id, propriedade_id, nome) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Financeiro básico'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'Perfil Cliente B');

insert into public.perfil_acesso_permissoes (id, perfil_acesso_id, modulo, pode_ver, pode_lancar) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'financeiro_negocio', true, false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'producao', true, true);

-- membro nao-admin: nenhum acesso, nem leitura
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'membro nao-admin nao deve enxergar perfil_acesso_permissoes, nem da propria propriedade'
);

-- admin: SELECT/INSERT so nos perfis da propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'admin deve enxergar permissoes de perfil da propria propriedade'
);

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'admin nao deve enxergar permissoes de perfil de outra propriedade'
);

insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
values ('44444444-4444-4444-4444-444444444444', 'imobilizado', true, false);

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '44444444-4444-4444-4444-444444444444'),
  2,
  'admin deve conseguir inserir permissao em perfil da propria propriedade'
);

select throws_ok(
  $$insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar) values ('66666666-6666-6666-6666-666666666666', 'fiscal', true, false)$$,
  'new row violates row-level security policy for table "perfil_acesso_permissoes"',
  'admin nao deve conseguir inserir permissao em perfil de outra propriedade'
);

-- dev: INSERT liberado em qualquer perfil
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
values ('66666666-6666-6666-6666-666666666666', 'fiscal', true, false);

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '66666666-6666-6666-6666-666666666666'),
  2,
  'dev deve conseguir inserir permissao em perfil de propriedade que nao e a sua'
);

select * from finish();
rollback;
