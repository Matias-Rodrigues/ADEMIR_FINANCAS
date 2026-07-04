begin;
select plan(5);

insert into public.propriedades (id, nome)
values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');

insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');

insert into public.usuarios (id, propriedade_id, papel)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');

select has_table('public', 'usuarios', 'tabela usuarios deve existir');
select has_table('public', 'perfis_acesso', 'tabela perfis_acesso deve existir');
select has_table('public', 'perfil_acesso_permissoes', 'tabela perfil_acesso_permissoes deve existir');

insert into public.perfis_acesso (id, propriedade_id, nome)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Financeiro básico');

insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
values ('44444444-4444-4444-4444-444444444444', 'financeiro_negocio', true, false);

insert into auth.users (id, email)
values ('55555555-5555-5555-5555-555555555555', 'membro@teste.com');

insert into public.usuarios (id, propriedade_id, papel, perfil_acesso_id)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia', '44444444-4444-4444-4444-444444444444');

select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select ok(
  public.tem_permissao('financeiro_negocio', 'ver'),
  'membro com pode_ver=true deve ter permissão de ver'
);

select ok(
  not public.tem_permissao('financeiro_negocio', 'lancar'),
  'membro com pode_lancar=false não deve ter permissão de lançar'
);

select * from finish();
rollback;
