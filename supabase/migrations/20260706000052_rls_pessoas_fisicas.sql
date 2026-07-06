create policy "admin da propriedade e dev podem ver pessoas_fisicas"
  on public.pessoas_fisicas for select
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem inserir pessoas_fisicas"
  on public.pessoas_fisicas for insert
  with check (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem atualizar pessoas_fisicas"
  on public.pessoas_fisicas for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir pessoas_fisicas"
  on public.pessoas_fisicas for delete
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );
