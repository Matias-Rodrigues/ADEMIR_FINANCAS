begin;
select plan(5);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_column('public', 'producao_leite', 'observacoes', 'coluna observacoes deve existir');
select has_column('public', 'producao_leite', 'transcricao', 'coluna transcricao deve existir');
select has_column('public', 'producao_leite', 'audio_paths', 'coluna audio_paths deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, criado_por, origem, observacoes, transcricao, audio_paths)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-08', 1000, 10, 6, '33333333-3333-3333-3333-333333333333', 'app_audio', 'Vaca 12 mancando', 'a vaca doze ta mancando hoje', array['11111111-1111-1111-1111-111111111111/66666666-6666-6666-6666-666666666666/2026-07-08-1.webm']);

select is(
  (select origem from public.producao_leite where data = '2026-07-08'),
  'app_audio',
  'origem app_audio deve ser aceita'
);

select throws_ok(
  $$insert into public.producao_leite
    (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, criado_por, origem)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 100, 0, 0, '33333333-3333-3333-3333-333333333333', 'origem_invalida')$$,
  'new row for relation "producao_leite" violates check constraint "producao_leite_origem_check"',
  'origem fora da lista continua rejeitada'
);

select * from finish();
rollback;
