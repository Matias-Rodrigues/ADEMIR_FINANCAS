begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com'),
  ('99999999-9999-9999-9999-999999999999', 'admin-b@teste.com');

insert into public.usuarios (id, propriedade_id, papel, ativo) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin', true),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia', true),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev', true),
  ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'admin', true);

-- admin: SELECT deve enxergar todos os usuarios da propria propriedade, nao so a propria linha
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.usuarios where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'admin deve enxergar todos os usuarios da propria propriedade, nao so a propria linha'
);

select is(
  (select count(*)::int from public.usuarios where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  0,
  'admin nao deve enxergar usuarios de outra propriedade'
);

-- admin: UPDATE (desativar) usuario da propria propriedade
update public.usuarios set ativo = false where id = '55555555-5555-5555-5555-555555555555';

select is(
  (select ativo from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  false,
  'admin deve conseguir desativar um usuario da propria propriedade'
);

-- admin: UPDATE em usuario de outra propriedade nao deve ter efeito
update public.usuarios set ativo = false where id = '99999999-9999-9999-9999-999999999999';

-- leitura de verificacao precisa sair do role restrito: a policy de SELECT desta task
-- so permite ao admin ver usuarios da PROPRIA propriedade, entao ler o usuario de outra
-- propriedade sob o role authenticated (admin) retornaria NULL em vez do valor real.
reset role;

select is(
  (select ativo from public.usuarios where id = '99999999-9999-9999-9999-999999999999'),
  true,
  'admin nao deve conseguir desativar usuario de outra propriedade'
);

set local role authenticated;

-- admin: INSERT continua bloqueado (sem policy)
select throws_ok(
  $$insert into public.usuarios (id, propriedade_id, papel) values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'membro_familia')$$,
  'new row violates row-level security policy for table "usuarios"',
  'admin nao deve conseguir inserir usuario diretamente (sem policy de insert)'
);

-- membro nao-admin: continua so vendo a propria linha
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.usuarios where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'membro nao-admin deve continuar vendo so a propria linha, nao os demais usuarios'
);

select * from finish();
rollback;
