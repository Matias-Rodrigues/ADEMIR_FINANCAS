-- As 5 tabelas abaixo foram criadas antes da migration de ALTER DEFAULT PRIVILEGES
-- (20260704221244_grants_default_privileges.sql), que só afeta tabelas criadas
-- depois dela. Sem este GRANT explícito, um usuário `authenticated` real recebe
-- "permission denied" antes mesmo da RLS ser avaliada.
grant select, insert, update, delete on public.propriedades to authenticated;
grant select, insert, update, delete on public.pessoas_fisicas to authenticated;
grant select, insert, update, delete on public.usuarios to authenticated;
grant select, insert, update, delete on public.perfis_acesso to authenticated;
grant select, insert, update, delete on public.perfil_acesso_permissoes to authenticated;
