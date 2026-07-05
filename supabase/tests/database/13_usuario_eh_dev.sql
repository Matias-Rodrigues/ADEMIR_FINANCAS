begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select ok(
  public.usuario_eh_dev(),
  'usuario_eh_dev() deve retornar true para papel=dev'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select ok(
  not public.usuario_eh_dev(),
  'usuario_eh_dev() deve retornar false para papel diferente de dev'
);

select * from finish();
rollback;
