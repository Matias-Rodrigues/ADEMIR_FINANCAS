create policy "membros da propriedade e dev podem ver propriedade"
  on public.propriedades for select
  using (id = public.usuario_propriedade_id() or public.usuario_eh_dev());

create policy "admin da propriedade e dev podem atualizar propriedade"
  on public.propriedades for update
  using (
    (id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "somente dev pode criar propriedade"
  on public.propriedades for insert
  with check (public.usuario_eh_dev());

create policy "somente dev pode excluir propriedade"
  on public.propriedades for delete
  using (public.usuario_eh_dev());
