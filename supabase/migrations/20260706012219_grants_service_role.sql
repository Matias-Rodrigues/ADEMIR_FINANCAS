-- A migration 20260704221244_grants_default_privileges.sql concedeu privilégios
-- por default apenas ao papel `authenticated`, esquecendo `service_role`. Como
-- `service_role` tem BYPASSRLS mas não ganha grants de tabela automaticamente,
-- qualquer INSERT/UPDATE/DELETE/SELECT via REST com a service_role key falha
-- com "permission denied" antes mesmo da RLS ser avaliada.
--
-- Escopo intencionalmente mínimo: só as duas tabelas que o Route Handler de
-- criação de usuário (Task 5) realmente usa via service role — `usuarios` e
-- `pessoas_fisicas`. As demais tabelas de negócio não são tocadas via service
-- role nesta spec, então não recebem backfill aqui.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

grant select, insert, update, delete on public.usuarios to service_role;
grant select, insert, update, delete on public.pessoas_fisicas to service_role;
