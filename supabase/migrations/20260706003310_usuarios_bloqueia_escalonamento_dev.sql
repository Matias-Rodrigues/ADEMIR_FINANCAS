drop policy "admin da propriedade e dev podem atualizar usuarios" on public.usuarios;

create policy "admin da propriedade e dev podem atualizar usuarios"
  on public.usuarios for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  )
  with check (
    public.usuario_eh_dev()
    or (
      propriedade_id = public.usuario_propriedade_id()
      and public.usuario_eh_admin()
      and papel <> 'dev'
    )
  );
