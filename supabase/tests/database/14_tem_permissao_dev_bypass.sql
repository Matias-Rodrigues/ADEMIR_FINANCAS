begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select ok(
  public.tem_permissao('fiscal', 'ver'),
  'dev sem perfil_acesso_id deve ter tem_permissao=true (bypass antes da checagem de perfil)'
);

select ok(
  public.tem_permissao('financeiro_negocio', 'lancar'),
  'dev deve ter tem_permissao=true para qualquer combinacao de modulo/acao'
);

select * from finish();
rollback;
