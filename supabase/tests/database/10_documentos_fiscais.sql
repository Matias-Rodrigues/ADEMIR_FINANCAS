begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'fiscal', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');

select has_table('public', 'documentos_fiscais', 'tabela documentos_fiscais deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.documentos_fiscais (propriedade_id, tipo, numero_documento, valor, data_emissao, arquivo_url)
values ('11111111-1111-1111-1111-111111111111', 'boleto', '00012345', 890.50, '2026-07-01', 'documentos/boleto-00012345.jpg');

select is(
  (select count(*)::int from public.documentos_fiscais),
  1,
  'documento fiscal deve ser inserido com status_revisao padrão pendente'
);

select is(
  (select status_revisao from public.documentos_fiscais limit 1),
  'pendente_revisao',
  'status_revisao deve nascer como pendente_revisao por padrão'
);

select * from finish();
rollback;
