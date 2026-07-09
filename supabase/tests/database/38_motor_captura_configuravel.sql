begin;
select plan(8);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values
  ('11111111-1111-1111-1111-111111111111', 'producao', true),
  ('77777777-7777-7777-7777-777777777777', 'producao', true);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com'),
  ('99999999-9999-9999-9999-999999999999', 'membro1@teste.com'),
  ('66666666-6666-6666-6666-666666666666', 'membro2@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev'),
  ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'membro_familia'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'membro_familia');

insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 'Gado leiteiro', 'leite');

select has_table('public', 'configuracoes_captura_animal', 'tabela configuracoes_captura_animal deve existir');
select has_table('public', 'ordem_captura_animal', 'tabela ordem_captura_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', '101', 'femea', 'vaca_lactacao', '88888888-8888-8888-8888-888888888888');

insert into public.configuracoes_captura_animal (propriedade_id, usuario_id, estilo_interacao, exibir_categoria, criado_por)
values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'tocar_para_revelar', true, '88888888-8888-8888-8888-888888888888');

select is(
  (select count(*)::int from public.configuracoes_captura_animal),
  1,
  'dev deve conseguir configurar captura para usuario de propriedade que nao e a sua'
);

insert into public.ordem_captura_animal (propriedade_id, usuario_id, animal_id, posicao)
values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', 1);

select is(
  (select count(*)::int from public.ordem_captura_animal),
  1,
  'dev deve conseguir definir ordem de captura para animal de propriedade que nao e a sua'
);

select throws_ok(
  $$insert into public.configuracoes_captura_animal (propriedade_id, usuario_id, estilo_interacao, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'invalido', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "configuracoes_captura_animal" violates check constraint "configuracoes_captura_animal_estilo_interacao_check"',
  'estilo_interacao fora da lista deve ser rejeitado'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select throws_ok(
  $$insert into public.configuracoes_captura_animal (propriedade_id, usuario_id, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333')$$,
  'new row violates row-level security policy for table "configuracoes_captura_animal"',
  'admin (nao-dev) nao deve conseguir configurar propria captura'
);

select set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-9999-9999-999999999999')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.configuracoes_captura_animal),
  1,
  'usuario dono da configuracao deve conseguir ve-la (SELECT propria)'
);

select set_config('request.jwt.claims', json_build_object('sub', '66666666-6666-6666-6666-666666666666')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.configuracoes_captura_animal),
  0,
  'outro usuario da mesma propriedade nao deve ver configuracao alheia (isolamento por usuario, nao so por propriedade)'
);

select * from finish();
rollback;
