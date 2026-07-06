drop policy "usuarios podem ver a própria linha" on public.usuarios;

create policy "usuarios podem ver a própria linha"
  on public.usuarios for select
  using (
    id = auth.uid()
    or public.usuario_eh_dev()
    or (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
  );

create policy "admin da propriedade e dev podem atualizar usuarios"
  on public.usuarios for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir usuarios"
  on public.usuarios for delete
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );
