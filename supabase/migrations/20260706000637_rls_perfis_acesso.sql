create policy "admin da propriedade e dev podem ver perfis_acesso"
  on public.perfis_acesso for select
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem inserir perfis_acesso"
  on public.perfis_acesso for insert
  with check (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem atualizar perfis_acesso"
  on public.perfis_acesso for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir perfis_acesso"
  on public.perfis_acesso for delete
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );
