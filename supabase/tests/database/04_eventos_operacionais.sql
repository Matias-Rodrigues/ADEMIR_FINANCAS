begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'eventos_operacionais', 'tabela eventos_operacionais deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, unidade_medida, descricao, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'producao', '2026-07-01', 1016, 'litros', 'Produção do dia', 'whatsapp_texto', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.eventos_operacionais),
  1,
  'evento operacional deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.eventos_operacionais (propriedade_id, unidade_negocio_id, tipo_evento, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'tipo_invalido', '2026-07-01', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "eventos_operacionais" violates check constraint "eventos_operacionais_tipo_evento_check"',
  'tipo_evento fora do enum deve ser rejeitado'
);

select * from finish();
rollback;
