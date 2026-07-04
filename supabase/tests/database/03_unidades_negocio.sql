begin;
select plan(4);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('99999999-9999-9999-9999-999999999999', 'Outra Propriedade');

insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');

select has_table('public', 'unidades_negocio', 'tabela unidades_negocio deve existir');

insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite'),
  ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'Outra unidade', 'outro');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.unidades_negocio),
  1,
  'RLS deve mostrar só as unidades de negócio da própria propriedade'
);

select ok(
  (select nome from public.unidades_negocio limit 1) = 'Gado leiteiro',
  'a unidade visível deve ser a da propriedade do usuário logado'
);

select throws_ok(
  $$insert into public.unidades_negocio (propriedade_id, nome, tipo) values ('11111111-1111-1111-1111-111111111111', 'Inválida', 'inexistente')$$,
  'new row for relation "unidades_negocio" violates check constraint "unidades_negocio_tipo_check"',
  'tipo fora do enum deve ser rejeitado'
);

select * from finish();
rollback;
