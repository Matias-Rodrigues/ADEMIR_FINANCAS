create policy "editar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));
