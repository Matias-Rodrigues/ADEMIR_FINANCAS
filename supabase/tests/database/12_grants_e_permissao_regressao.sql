begin;
select plan(2);

-- Setup: propriedade, usuarios e perfis de acesso usados pelos dois cenarios.
-- Tudo inserido antes de qualquer troca de role, seguindo o mesmo padrao dos
-- demais arquivos de teste (bypass de RLS via role padrao do runner).
insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');

insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'credito_obrigacoes', true);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com'),
  ('44444444-4444-4444-4444-444444444444', 'membro@teste.com'),
  ('66666666-6666-6666-6666-666666666666', 'restrito@teste.com');

insert into public.perfis_acesso (id, propriedade_id, nome)
  values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Sem permissao de credito');
insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
  values ('55555555-5555-5555-5555-555555555555', 'credito_obrigacoes', false, false);

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'membro_familia');

insert into public.usuarios (id, propriedade_id, papel, perfil_acesso_id)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'membro_familia', '55555555-5555-5555-5555-555555555555');

insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

insert into public.obrigacoes_credito (id, propriedade_id, instituicao, tipo, unidade_negocio_id, valor_total, data_contratacao)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Cresol', 'consorcio', '77777777-7777-7777-7777-777777777777', 150000.00, '2025-01-15');

insert into public.parcelas_credito (obrigacao_credito_id, numero_parcela, valor, data_vencimento)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 15000.00, '2026-08-15');

-- Cenário 1 (Correção 1): usuário authenticated real (não-admin) deve conseguir
-- ver a própria linha em public.usuarios sem erro de permissão. Antes do GRANT
-- explícito nas 5 tabelas anteriores à migration de default privileges, este
-- SELECT falhava com "permission denied for table usuarios" antes mesmo da RLS
-- ser avaliada.
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.usuarios where id = '44444444-4444-4444-4444-444444444444'),
  1,
  'usuario authenticated deve conseguir ver a propria linha em usuarios sem erro de permissao'
);

-- Cenário 2 (Correção 3): usuário authenticated com perfil de acesso restrito
-- (pode_ver = false para credito_obrigacoes) não deve enxergar nenhuma linha em
-- parcelas_credito, mesmo existindo parcela cadastrada na mesma propriedade.
select set_config('request.jwt.claims', json_build_object('sub', '66666666-6666-6666-6666-666666666666')::text, true);

select is(
  (select count(*)::int from public.parcelas_credito),
  0,
  'usuario sem permissao de ver em credito_obrigacoes nao deve enxergar parcelas de credito'
);

select * from finish();
rollback;
