begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select throws_ok(
  $$update public.usuarios set papel = 'dev' where id = '55555555-5555-5555-5555-555555555555'$$,
  'new row violates row-level security policy for table "usuarios"',
  'admin nao deve conseguir promover um usuario a papel=dev via UPDATE'
);

select throws_ok(
  $$update public.usuarios set papel = 'dev' where id = '33333333-3333-3333-3333-333333333333'$$,
  'new row violates row-level security policy for table "usuarios"',
  'admin nao deve conseguir se autopromover a papel=dev via UPDATE'
);

update public.usuarios set ativo = false where id = '55555555-5555-5555-5555-555555555555';

select is(
  (select ativo from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  false,
  'admin ainda deve conseguir atualizar outros campos (ex: ativo) normalmente, sem afetar papel'
);

select * from finish();
rollback;
