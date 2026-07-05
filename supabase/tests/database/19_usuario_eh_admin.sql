begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select ok(
  public.usuario_eh_admin(),
  'usuario_eh_admin() deve retornar true para papel=admin'
);

select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select ok(
  not public.usuario_eh_admin(),
  'usuario_eh_admin() deve retornar false para papel diferente de admin'
);

select * from finish();
rollback;
