begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Sem Entitlement');
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

-- propriedade nao tem NENHUMA linha em propriedade_modulos_contratados

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select ok(
  not public.tem_permissao('fiscal', 'ver'),
  'admin de propriedade sem entitlement para o modulo nao deve ter tem_permissao=true, mesmo sendo admin'
);

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select ok(
  public.tem_permissao('fiscal', 'ver'),
  'dev deve continuar com tem_permissao=true mesmo em modulo nao contratado (bypass e checado antes do gate de entitlement)'
);

select * from finish();
rollback;
