create policy "admin da propriedade e dev podem ver perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for select
  using (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem inserir perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for insert
  with check (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem atualizar perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for update
  using (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for delete
  using (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );
