begin;
select plan(2);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Sem Producao'),
  ('22222222-2222-2222-2222-222222222222', 'Propriedade Com Producao');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin1@teste.com'),
  ('44444444-4444-4444-4444-444444444444', 'admin2@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'admin');

-- so a segunda propriedade tem entitlement para producao
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('22222222-2222-2222-2222-222222222222', 'producao', true);

insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite'),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Suínos', 'suinos');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.unidades_negocio),
  0,
  'admin de propriedade sem entitlement para producao nao deve ver nenhuma unidade_negocio'
);

select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.unidades_negocio),
  1,
  'admin de propriedade com entitlement para producao deve ver a propria unidade_negocio normalmente'
);

select * from finish();
rollback;
