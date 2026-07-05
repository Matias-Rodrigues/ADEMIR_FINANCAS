begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Suínos', 'suinos');

select has_table('public', 'parcerias_integracao', 'tabela parcerias_integracao deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.parcerias_integracao (propriedade_id, unidade_negocio_id, empresa_parceira, condicoes, ciclo_dias, forma_pagamento)
values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 'Alibem Alimentos', 'Exclusividade - fornece leitões, ração e assistência técnica', 120, '30 dias após carregamento');

select is(
  (select count(*)::int from public.parcerias_integracao),
  1,
  'parceria de integração deve ser inserida e visível pelo admin'
);

select * from finish();
rollback;
