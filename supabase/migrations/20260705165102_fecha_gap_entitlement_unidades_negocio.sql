drop policy "ver unidades de negocio da propria propriedade" on public.unidades_negocio;
create policy "ver unidades de negocio da propria propriedade"
  on public.unidades_negocio for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));
